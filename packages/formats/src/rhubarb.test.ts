import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { mapRhubarbJson } from "./rhubarb.js";
import { rhubarbJsonSchema } from "./schemas.js";

const fixture = rhubarbJsonSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("../fixtures/rhubarb-intro-001.json", import.meta.url),
      "utf8",
    ),
  ),
);

describe("Rhubarb JSON", () => {
  it("reads metadata and mouthCues, maps letters, and drops end", () => {
    expect(fixture.metadata.soundFile).toBe("audio/intro-001.wav");
    expect(fixture.mouthCues[0]).toEqual({ start: 0, end: 0.05, value: "X" });
    const mapped = mapRhubarbJson(fixture, { hasL: false });
    expect(mapped).toEqual([
      { time: 0, shape: "REST" },
      { time: 0.05, shape: "EH/AE" },
      { time: 0.42, shape: "MBP" },
      { time: 0.55, shape: "OO/W" },
      { time: 1.1, shape: "FV" },
      { time: 1.4, shape: "CONS/EE" },
      { time: 1.7, shape: "CONS/EE" },
    ]);
    expect(mapped.every((cue) => !("end" in cue))).toBe(true);
    expect(mapRhubarbJson(fixture, { hasL: true })[5]).toEqual({
      time: 1.4,
      shape: "L",
    });
  });
});
