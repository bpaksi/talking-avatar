import { describe, expect, it } from "vitest";

import {
  DEFAULT_ANTICIPATION_FRAMES,
  DEFAULT_FRAME_RATE,
} from "./anticipation.js";
import { buildCueTrack } from "./cue-track.js";
import { applyOverrides } from "./overrides.js";
import { overridesSchema, rhubarbJsonSchema } from "./schemas.js";

describe("overrides", () => {
  it("accepts the object schema and rejects an array", () => {
    expect(overridesSchema.parse({})).toEqual({ cues: [], remove: [] });
    expect(overridesSchema.parse({ remove: [0.18] })).toEqual({
      cues: [],
      remove: [0.18],
    });
    expect(
      overridesSchema.safeParse([{ time: 0.1, shape: "MBP" }]).success,
    ).toBe(false);
  });

  it("replaces, inserts, removes, and sorts", () => {
    const track = [
      { time: 0.4, shape: "AH" as const },
      { time: 0.2, shape: "EH/AE" as const },
    ];
    const merged = applyOverrides(track, {
      cues: [
        { time: 0.2, shape: "MBP" },
        { time: 0.1, shape: "FV" },
      ],
      remove: [0.4],
    });
    expect(merged).toEqual([
      { time: 0.1, shape: "FV" },
      { time: 0.2, shape: "MBP" },
    ]);
  });

  it("lets remove win when a time is in both lists", () => {
    expect(
      applyOverrides([{ time: 0.2, shape: "AH" }], {
        cues: [{ time: 0.2, shape: "MBP" }],
        remove: [0.2],
      }),
    ).toEqual([]);
  });

  it("does not shift an override cue, and does shift a generated MBP", () => {
    const lead = DEFAULT_ANTICIPATION_FRAMES / DEFAULT_FRAME_RATE;
    const rhubarb = rhubarbJsonSchema.parse({
      metadata: { soundFile: "a.wav", duration: 1 },
      mouthCues: [
        { start: 0, end: 0.5, value: "X" },
        { start: 0.5, end: 1, value: "A" },
      ],
    });
    expect(buildCueTrack(rhubarb, null, { hasL: false })).toEqual([
      { time: 0, shape: "REST" },
      { time: 0.5 - lead, shape: "MBP" },
    ]);
    expect(
      buildCueTrack(
        rhubarb,
        { cues: [{ time: 0.5, shape: "MBP" }], remove: [] },
        { hasL: false },
      ),
    ).toEqual([
      { time: 0, shape: "REST" },
      { time: 0.5, shape: "MBP" },
    ]);
  });
});
