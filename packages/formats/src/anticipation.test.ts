import { describe, expect, it } from "vitest";

import { applyAnticipation } from "./anticipation.js";

const lead = 2 / 24;

describe("anticipation", () => {
  it("leads MBP and OO/W by two frames at 24 fps and clamps at zero", () => {
    expect(
      applyAnticipation(
        [
          { time: 0, shape: "REST" },
          { time: 0.5, shape: "MBP" },
          { time: 0.8, shape: "OO/W" },
          { time: 1, shape: "EH/AE" },
        ],
        [],
      ),
    ).toEqual([
      { time: 0, shape: "REST" },
      { time: 0.5 - lead, shape: "MBP" },
      { time: 0.8 - lead, shape: "OO/W" },
      { time: 1, shape: "EH/AE" },
    ]);
    expect(applyAnticipation([{ time: 0.05, shape: "MBP" }], [])).toEqual([
      { time: 0, shape: "MBP" },
    ]);
    expect(applyAnticipation([{ time: 0, shape: "OO/W" }], [])).toEqual([
      { time: 0, shape: "OO/W" },
    ]);
  });

  it("leaves the cue when the previous cue already fills the lead window", () => {
    expect(
      applyAnticipation(
        [
          { time: 0.15, shape: "REST" },
          { time: 0.2, shape: "MBP" },
        ],
        [],
      ),
    ).toEqual([
      { time: 0.15, shape: "REST" },
      { time: 0.2, shape: "MBP" },
    ]);
  });

  it("does not move a protected override time", () => {
    expect(applyAnticipation([{ time: 0.5, shape: "MBP" }], [0.5])).toEqual([
      { time: 0.5, shape: "MBP" },
    ]);
  });
});
