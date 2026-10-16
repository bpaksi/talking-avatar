import { describe, expect, it } from "vitest";
import { captionOnlyLine } from "./line.js";
import {
  castSchema,
  lineJsonSchema,
  scriptSchema,
  shapeIdSchema,
} from "./schemas.js";
import { REQUIRED_SHAPES } from "./shapes.js";

describe("schemas", () => {
  it("requires the eight shapes and keeps L and TH optional", () => {
    expect(REQUIRED_SHAPES).toHaveLength(8);
    expect(REQUIRED_SHAPES).not.toContain("L");
    expect(REQUIRED_SHAPES).not.toContain("TH");
    expect(shapeIdSchema.safeParse("FV").success).toBe(true);
    expect(shapeIdSchema.safeParse("EH").success).toBe(false);
    expect(shapeIdSchema.safeParse("OO").success).toBe(false);
  });

  it("accepts an optional non-empty captionTheme on a cast speaker", () => {
    const speaker = {
      voice: { provider: "gemini", voiceId: "voice-1" },
      portrait: "art/guide.png",
      mouths: {
        REST: "m/rest.png",
        MBP: "m/mbp.png",
        "CONS/EE": "m/cons-ee.png",
        "EH/AE": "m/eh-ae.png",
        AH: "m/ah.png",
        "OH/ER": "m/oh-er.png",
        "OO/W": "m/oo-w.png",
        FV: "m/fv.png",
      },
      anchor: { x: 120, y: 210 },
    };
    const themed = castSchema.parse({
      guide: { ...speaker, captionTheme: "gothic" },
    });
    expect(themed.guide?.captionTheme).toBe("gothic");
    expect(castSchema.parse({ guide: speaker }).guide?.captionTheme).toBe(
      undefined,
    );
    expect(
      castSchema.safeParse({ guide: { ...speaker, captionTheme: "" } }).success,
    ).toBe(false);
    expect(
      castSchema.safeParse({ guide: { ...speaker, captionTheme: 3 } }).success,
    ).toBe(false);
  });

  it("parses the narrator cast and the sample script", () => {
    const cast = castSchema.parse({
      narrator: {
        voice: { provider: "gemini", voiceId: "voice-1", style: "calm, warm" },
        portrait: "art/narrator.png",
        mouths: {
          REST: "m/rest.png",
          MBP: "m/mbp.png",
          "CONS/EE": "m/cons-ee.png",
          "EH/AE": "m/eh-ae.png",
          AH: "m/ah.png",
          "OH/ER": "m/oh-er.png",
          "OO/W": "m/oo-w.png",
          FV: "m/fv.png",
        },
        anchor: { x: 120, y: 210 },
      },
    });
    expect(cast.narrator?.voice.voiceId).toBe("voice-1");
    const script = scriptSchema.parse({
      id: "intro",
      lines: [
        {
          id: "intro-001",
          speaker: "narrator",
          text: "Welcome. [pause 0.5] Follow me.",
        },
      ],
    });
    expect(script.lines[0]?.speaker).toBe("narrator");
    expect(
      lineJsonSchema.safeParse({
        ...captionOnlyLine("intro-001", "Hello"),
        cues: [{ time: 0, shape: "MBP" }],
      }).success,
    ).toBe(false);
    expect(
      scriptSchema.safeParse({
        id: "intro",
        lines: [{ id: "x", speaker: "narrator", text: "Hi [pause]" }],
      }).success,
    ).toBe(false);
  });
});
