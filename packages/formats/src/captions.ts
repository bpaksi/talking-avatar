import { parseLineText, spokenSegments } from "./pause.js";

export const CHARS_PER_SECOND = 12.5;
export const MAX_LINE_SECONDS = 20;

export type WordTiming = {
  word: string;
  start: number;
  end: number;
};

function codePoints(text: string): number {
  return [...text].length;
}

export function estimateLineSeconds(text: string): number {
  let seconds = 0;
  for (const segment of parseLineText(text)) {
    if (segment.type === "pause") seconds += segment.seconds;
    else
      seconds +=
        codePoints(segment.text.replace(/\s/gu, "")) / CHARS_PER_SECOND;
  }
  return seconds;
}

export function lineExceedsLimit(text: string): boolean {
  return estimateLineSeconds(text) > MAX_LINE_SECONDS;
}

export function fallbackWords(text: string): WordTiming[] {
  const words: WordTiming[] = [];
  let cursor = 0;
  for (const segment of parseLineText(text)) {
    if (segment.type === "pause") {
      cursor += segment.seconds;
      continue;
    }
    for (const word of segment.text.split(/\s+/u)) {
      if (word.length === 0) continue;
      const duration = codePoints(word) / CHARS_PER_SECOND;
      words.push({ word, start: cursor, end: cursor + duration });
      cursor += duration;
    }
  }
  return words;
}

export function captionText(text: string): string {
  return spokenSegments(text).join(" ");
}
