import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { avatarManifestSchema, effectiveMouthMode } from "./avatar.js";
import { readImageInfo } from "./image.js";
import { readPngInfo } from "./png.js";
import { type AvatarIssue, validateAvatar } from "./validate.js";
import { readWebpInfo } from "./webp.js";

const fixture = (path: string) =>
  fileURLToPath(new URL(`../fixtures/${path}`, import.meta.url));

describe("validateAvatar: valid folders", () => {
  it("accepts the Keeper fixture with zero errors", async () => {
    expect(await validateAvatar(fixture("keeper"))).toEqual([]);
  });

  it("accepts the minimal frame and overlay folders", async () => {
    expect(await validateAvatar(fixture("minimal/frame/keeper"))).toEqual([]);
    expect(await validateAvatar(fixture("minimal/overlay/keeper"))).toEqual([]);
  });

  it("accepts a valid folder when mouthMode is omitted", async () => {
    const manifest = JSON.parse(
      readFileSync(fixture("minimal/frame/keeper/manifest.json"), "utf8"),
    ) as { mouthMode?: unknown };
    expect(manifest.mouthMode).toBeUndefined();
    expect(await validateAvatar(fixture("minimal/frame/keeper"))).toEqual([]);
  });

  it("parses the Keeper line ids and treats omitted mouthMode as frame", () => {
    const manifest = avatarManifestSchema.parse(
      JSON.parse(readFileSync(fixture("keeper/manifest.json"), "utf8")),
    );
    expect(manifest.lines.map((line) => line.line_id)).toEqual([
      "ts-keeper-001",
      "ts-keeper-002",
      "ts-keeper-003",
    ]);
    expect(effectiveMouthMode(manifest)).toBe("frame");
    expect(effectiveMouthMode({})).toBe("frame");
  });
});

type Expected = Pick<AvatarIssue, "rule" | "file"> & { lineId?: string };

const LINE = "ts-keeper-001";
const NEGATIVE: Record<string, Expected> = {
  "missing-letter": { rule: 1, file: "manifest.json" },
  "missing-file": { rule: 2, file: "mouths/FV.png" },
  "duplicate-line-id": { rule: 3, file: "manifest.json", lineId: LINE },
  "missing-text": { rule: 3, file: "manifest.json", lineId: LINE },
  "anchor-out-of-range": { rule: 4, file: "anchor.json" },
  "bad-cue-letter": { rule: 5, file: `lines/${LINE}.json`, lineId: LINE },
  "overlapping-cues": { rule: 6, file: `lines/${LINE}.json`, lineId: LINE },
  "empty-caption-theme": { rule: 7, file: "manifest.json" },
  "wrong-mouth-size": { rule: 8, file: "mouths/AH.png" },
  "wrong-mouth-size-default-mode": { rule: 8, file: "mouths/AH.png" },
  "unknown-mouth-mode": { rule: 8, file: "manifest.json" },
  "overlay-no-alpha": { rule: 8, file: "mouths/REST.png" },
  "overlay-wrong-size": { rule: 8, file: "mouths/REST.png" },
  "id-mismatch": { rule: 9, file: "manifest.json" },
  "absolute-path": { rule: 10, file: "manifest.json" },
};

describe("validateAvatar: negative fixtures", () => {
  it.each(Object.entries(NEGATIVE))(
    "%s fails with the expected rule and names the file",
    async (name, expected) => {
      const issues = await validateAvatar(fixture(`invalid/${name}/keeper`));
      expect(issues.length).toBeGreaterThan(0);
      for (const issue of issues) {
        expect(issue.rule, issue.message).toBe(expected.rule);
        expect(issue.message.length).toBeGreaterThan(0);
      }
      expect(issues).toContainEqual(expect.objectContaining(expected));
      if (expected.lineId === undefined) {
        expect(issues.every((issue) => issue.lineId === undefined)).toBe(true);
      }
    },
  );

  it("reports a missing manifest and a missing folder without throwing", async () => {
    expect(await validateAvatar(fixture("invalid/does-not-exist"))).toEqual([
      expect.objectContaining({ rule: 2, file: "manifest.json" }),
    ]);
  });
});

/** Header-only WebP bytes (the validator reads headers, not pixels). */
function webpHeader(
  kind: "VP8X" | "VP8L" | "VP8 ",
  width: number,
  height: number,
  alpha: boolean,
): Uint8Array {
  const bytes = new Uint8Array(30);
  const view = new DataView(bytes.buffer);
  const put = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      bytes[offset + i] = text.charCodeAt(i);
    }
  };
  put(0, "RIFF");
  view.setUint32(4, 22, true);
  put(8, "WEBP");
  put(12, kind);
  view.setUint32(16, 10, true);
  if (kind === "VP8X") {
    bytes[20] = alpha ? 0x10 : 0;
    const w = width - 1;
    const h = height - 1;
    bytes.set([w & 255, (w >> 8) & 255, (w >> 16) & 255], 24);
    bytes.set([h & 255, (h >> 8) & 255, (h >> 16) & 255], 27);
  } else if (kind === "VP8L") {
    bytes[20] = 0x2f;
    const bits = (width - 1) | ((height - 1) << 14) | ((alpha ? 1 : 0) << 28);
    view.setUint32(21, bits >>> 0, true);
  } else {
    bytes.set([0x9d, 0x01, 0x2a], 23);
    view.setUint16(26, width, true);
    view.setUint16(28, height, true);
  }
  return bytes;
}

describe("WebP portrait and mouths (contract v2)", () => {
  const SHAPES = [
    "REST",
    "MBP",
    "CONS-EE",
    "EH-AE",
    "AH",
    "OH-ER",
    "OO-W",
    "FV",
  ];

  function webpCopy(source: string, mouth: Uint8Array, portrait: Uint8Array) {
    // Rule 9: folder basename must equal manifest id ("keeper").
    const dir = join(mkdtempSync(join(tmpdir(), "avatar-webp-")), "keeper");
    cpSync(fixture(source), dir, { recursive: true });
    const manifestPath = join(dir, "manifest.json");
    writeFileSync(
      manifestPath,
      readFileSync(manifestPath, "utf8").replaceAll(".png", ".webp"),
    );
    rmSync(join(dir, "portrait.png"));
    writeFileSync(join(dir, "portrait.webp"), portrait);
    for (const shape of SHAPES) {
      rmSync(join(dir, `mouths/${shape}.png`));
      writeFileSync(join(dir, `mouths/${shape}.webp`), mouth);
    }
    return dir;
  }

  it("accepts WebP frame mouths (lossy VP8) at the portrait size", async () => {
    const dir = webpCopy(
      "minimal/frame/keeper",
      webpHeader("VP8 ", 32, 40, false),
      webpHeader("VP8L", 32, 40, true),
    );
    expect(await validateAvatar(dir)).toEqual([]);
  });

  it("accepts transparent WebP overlay mouths and rejects opaque ones", async () => {
    const portrait = webpHeader("VP8X", 32, 40, true);
    const ok = webpCopy(
      "minimal/overlay/keeper",
      webpHeader("VP8L", 16, 10, true),
      portrait,
    );
    expect(await validateAvatar(ok)).toEqual([]);
    const opaque = webpCopy(
      "minimal/overlay/keeper",
      webpHeader("VP8 ", 16, 10, false),
      portrait,
    );
    const issues = await validateAvatar(opaque);
    expect(issues).toContainEqual(
      expect.objectContaining({ rule: 8, file: "mouths/AH.webp" }),
    );
  });

  it("rejects an image that is neither PNG nor WebP", async () => {
    const dir = webpCopy(
      "minimal/frame/keeper",
      new TextEncoder().encode("not an image at all, just some text"),
      webpHeader("VP8L", 32, 40, true),
    );
    expect(await validateAvatar(dir)).toContainEqual(
      expect.objectContaining({
        rule: 8,
        message: "mouths/AH.webp is not a PNG or WebP",
      }),
    );
  });
});

describe("readWebpInfo / readImageInfo", () => {
  it("reads size and alpha for VP8X, VP8L and VP8", () => {
    expect(readWebpInfo(webpHeader("VP8X", 300, 20, true))).toEqual({
      width: 300,
      height: 20,
      hasAlpha: true,
    });
    expect(readWebpInfo(webpHeader("VP8L", 16, 10, false))?.hasAlpha).toBe(
      false,
    );
    expect(readWebpInfo(webpHeader("VP8 ", 32, 40, false))).toEqual({
      width: 32,
      height: 40,
      hasAlpha: false,
    });
    expect(readWebpInfo(new TextEncoder().encode("x".repeat(40)))).toBeNull();
  });

  it("dispatches on content: PNG and WebP both read", () => {
    expect(readImageInfo(webpHeader("VP8L", 4, 5, true))).toEqual({
      width: 4,
      height: 5,
      hasAlpha: true,
    });
    expect(readImageInfo(readFileSync(fixture("keeper/portrait.png")))).toEqual(
      { width: 256, height: 320, hasAlpha: true },
    );
    expect(readImageInfo(new Uint8Array(40))).toBeNull();
  });
});

describe("readPngInfo", () => {
  it("reads size and alpha, and rejects non-PNG bytes", () => {
    const rgba = readPngInfo(readFileSync(fixture("keeper/portrait.png")));
    expect(rgba).toEqual({ width: 256, height: 320, hasAlpha: true });
    const rgb = readPngInfo(
      readFileSync(fixture("invalid/overlay-no-alpha/keeper/mouths/AH.png")),
    );
    expect(rgb?.hasAlpha).toBe(false);
    expect(readPngInfo(new TextEncoder().encode("not a png"))).toBeNull();
  });
});
