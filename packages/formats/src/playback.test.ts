import { describe, expect, it } from "vitest";

import { sampleAudioClock, shapeAt, visibleShape } from "./playback.js";

const cues = [
  { time: 0.2, shape: "EH/AE" as const },
  { time: 0.5, shape: "MBP" as const },
  { time: 0.9, shape: "OO/W" as const },
];

describe("playback clock", () => {
  it("samples audio.currentTime", () => {
    expect(sampleAudioClock({ currentTime: 1.25 })).toBe(1.25);
  });

  it("binary-searches the latest cue at or before the sample, else REST", () => {
    expect(shapeAt(cues, 0)).toBe("REST");
    expect(shapeAt(cues, 0.2)).toBe("EH/AE");
    expect(shapeAt(cues, 0.49)).toBe("EH/AE");
    expect(shapeAt(cues, 0.5)).toBe("MBP");
    expect(shapeAt(cues, 2)).toBe("OO/W");
  });

  it("holds REST without audio, under reduced motion, and before the first cue", () => {
    expect(
      visibleShape({
        cues,
        time: 0.5,
        audioAvailable: false,
        reducedMotion: false,
      }),
    ).toBe("REST");
    expect(
      visibleShape({
        cues,
        time: 0.5,
        audioAvailable: true,
        reducedMotion: true,
      }),
    ).toBe("REST");
    expect(
      visibleShape({
        cues,
        time: 0,
        audioAvailable: true,
        reducedMotion: false,
      }),
    ).toBe("REST");
    expect(
      visibleShape({
        cues,
        time: 0.5,
        audioAvailable: true,
        reducedMotion: false,
      }),
    ).toBe("MBP");
  });
});
