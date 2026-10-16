import type { ShapeId } from "./shapes.js";

export const RHUBARB_LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "X",
] as const;

export type RhubarbLetter = (typeof RHUBARB_LETTERS)[number];

export type RhubarbJson = {
  metadata: {
    soundFile: string;
    duration: number;
  };
  mouthCues: {
    start: number;
    end: number;
    value: RhubarbLetter;
  }[];
};

const LETTER_TO_SHAPE: Record<Exclude<RhubarbLetter, "H">, ShapeId> = {
  A: "MBP",
  B: "CONS/EE",
  C: "EH/AE",
  D: "AH",
  E: "OH/ER",
  F: "OO/W",
  G: "FV",
  X: "REST",
};

export function mapRhubarbLetter(value: RhubarbLetter, hasL: boolean): ShapeId {
  if (value === "H") return hasL ? "L" : "EH/AE";
  return LETTER_TO_SHAPE[value];
}

export type Cue = {
  time: number;
  shape: ShapeId;
};

export function mapRhubarbJson(
  doc: RhubarbJson,
  options: { hasL: boolean },
): Cue[] {
  return doc.mouthCues.map((cue) => ({
    time: cue.start,
    shape: mapRhubarbLetter(cue.value, options.hasL),
  }));
}
