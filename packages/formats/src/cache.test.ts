import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { timingCacheMaterial, ttsCacheMaterial } from "./cache.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("cache material", () => {
  it("changes the timing key when the anticipation lead or Rhubarb version changes", () => {
    const base = {
      text: "Welcome. Follow me.",
      audioHash: "audio",
      artHash: "art",
      anticipationFrames: 2,
      frameRate: 24,
      rhubarbVersion: "1.13.0",
      extendedShapes: "GX" as const,
    };
    const key = sha256(timingCacheMaterial(base));
    expect(
      sha256(timingCacheMaterial({ ...base, rhubarbVersion: "1.14.0" })),
    ).not.toBe(key);
    expect(
      sha256(timingCacheMaterial({ ...base, anticipationFrames: 1 })),
    ).not.toBe(key);
    expect(sha256(timingCacheMaterial({ ...base, frameRate: 12 }))).not.toBe(
      key,
    );
    expect(sha256(timingCacheMaterial(base))).toBe(key);
  });

  it("changes the TTS key when the voice config changes", () => {
    const base = {
      text: "Hello",
      provider: "gemini",
      voiceId: "a",
      style: "calm",
    };
    expect(ttsCacheMaterial(base)).not.toBe(
      ttsCacheMaterial({ ...base, voiceId: "b" }),
    );
    expect(ttsCacheMaterial(base)).not.toBe(
      ttsCacheMaterial({ ...base, style: "bright" }),
    );
  });
});
