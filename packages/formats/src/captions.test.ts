import { describe, expect, it } from "vitest";

import {
  CHARS_PER_SECOND,
  captionText,
  estimateLineSeconds,
  lineExceedsLimit,
} from "./captions.js";
import { captionOnlyLine } from "./line.js";
import { lineJsonSchema } from "./schemas.js";

const SAMPLE = "Welcome. [pause 0.5] Follow me.";

describe("caption-only line", () => {
  it("keeps the script text, drops audio and cues, and times words without audio", () => {
    const line = captionOnlyLine("intro-001", SAMPLE);
    expect(line).toEqual({
      lineId: "intro-001",
      text: SAMPLE,
      audio: null,
      cues: [],
      words: [
        { word: "Welcome.", start: 0, end: 8 / CHARS_PER_SECOND },
        {
          word: "Follow",
          start: 8 / CHARS_PER_SECOND + 0.5,
          end: 8 / CHARS_PER_SECOND + 0.5 + 6 / CHARS_PER_SECOND,
        },
        {
          word: "me.",
          start: 8 / CHARS_PER_SECOND + 0.5 + 6 / CHARS_PER_SECOND,
          end:
            8 / CHARS_PER_SECOND +
            0.5 +
            6 / CHARS_PER_SECOND +
            3 / CHARS_PER_SECOND,
        },
      ],
      captionTiming: "fallback",
    });
    expect(lineJsonSchema.parse(line)).toEqual(line);
    expect(captionText(SAMPLE)).toBe("Welcome. Follow me.");
  });

  it("flags an estimate over 20 seconds and passes exactly 20", () => {
    expect(lineExceedsLimit("a".repeat(250))).toBe(false);
    expect(estimateLineSeconds("a".repeat(250))).toBe(20);
    expect(lineExceedsLimit("a".repeat(251))).toBe(true);
    expect(lineExceedsLimit(`hi [pause ${20}]`)).toBe(true);
  });
});
