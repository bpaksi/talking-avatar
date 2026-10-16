import { describe, expect, it } from "vitest";

import {
  anchorSchema,
  isAvatarRelativePath,
  mouthFileName,
  mouthModeSchema,
} from "./avatar.js";
import { rhubarbJsonSchema } from "./schemas.js";

describe("asset contract schemas", () => {
  it("keeps paths inside the avatar folder (rule 10)", () => {
    for (const ok of ["portrait.png", "mouths/AH.png", "./lines/a.m4a"]) {
      expect(isAvatarRelativePath(ok), ok).toBe(true);
    }
    for (const bad of [
      "",
      "/avatars/keeper/portrait.png",
      "C:/art/portrait.png",
      "https://example.com/p.png",
      "data:image/png;base64,AAAA",
      "../other/portrait.png",
      "mouths/../../x.png",
      "mouths\\AH.png",
    ]) {
      expect(isAvatarRelativePath(bad), bad).toBe(false);
    }
  });

  it("checks anchor fractions and mouth modes", () => {
    expect(anchorSchema.safeParse({ x: 0, y: 1, w: 0.5, h: 0.5 }).success).toBe(
      true,
    );
    expect(anchorSchema.safeParse({ x: -0.1, y: 0, w: 0, h: 0 }).success).toBe(
      false,
    );
    expect(mouthModeSchema.safeParse("overlay").success).toBe(true);
    expect(mouthModeSchema.safeParse("sprite").success).toBe(false);
  });

  it("names mouth files without the slash", () => {
    expect(mouthFileName("CONS/EE")).toBe("CONS-EE.png");
    expect(mouthFileName("AH")).toBe("AH.png");
  });

  it("accepts touching cues and rejects overlap or reversed cues (rule 6)", () => {
    const doc = (cues: { start: number; end: number }[]) => ({
      metadata: { soundFile: "a.wav", duration: 1 },
      mouthCues: cues.map((cue) => ({ ...cue, value: "X" })),
    });
    expect(
      rhubarbJsonSchema.safeParse(
        doc([
          { start: 0, end: 0.5 },
          { start: 0.5, end: 0.5 },
          { start: 0.6, end: 1 },
        ]),
      ).success,
    ).toBe(true);
    expect(
      rhubarbJsonSchema.safeParse(
        doc([
          { start: 0, end: 0.5 },
          { start: 0.4, end: 1 },
        ]),
      ).success,
    ).toBe(false);
    expect(
      rhubarbJsonSchema.safeParse(doc([{ start: 0.5, end: 0.4 }])).success,
    ).toBe(false);
  });
});
