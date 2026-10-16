import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { avatarManifestSchema, effectiveMouthMode } from "./avatar.js";
import { readPngInfo } from "./png.js";
import { type AvatarIssue, validateAvatar } from "./validate.js";

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

  it("parses the Keeper manifest, defaulting mouthMode to frame", () => {
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
