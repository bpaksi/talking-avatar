import { describe, expect, it } from "vitest";

import { sampleAudioClock, visibleShape } from "./index.js";

describe("@talking-avatar/player", () => {
  it("samples currentTime and holds REST when audio is missing", () => {
    expect(sampleAudioClock({ currentTime: 0.4 })).toBe(0.4);
    expect(
      visibleShape({
        cues: [{ time: 0.4, shape: "MBP" }],
        time: 0.4,
        audioAvailable: false,
        reducedMotion: false,
      }),
    ).toBe("REST");
  });
});
