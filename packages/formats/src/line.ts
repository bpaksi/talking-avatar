import { fallbackWords } from "./captions.js";
import type { LineJson } from "./schemas.js";

export function captionOnlyLine(lineId: string, text: string): LineJson {
  return {
    lineId,
    text,
    audio: null,
    cues: [],
    words: fallbackWords(text),
    captionTiming: "fallback",
  };
}
