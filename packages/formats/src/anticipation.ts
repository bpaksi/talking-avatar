import type { Cue } from "./rhubarb.js";

export const DEFAULT_FRAME_RATE = 24;
export const DEFAULT_ANTICIPATION_FRAMES = 2;

export type AnticipationOptions = {
  frameRate?: number;
  anticipationFrames?: number;
};

export function anticipationLeadSeconds(
  options: AnticipationOptions = {},
): number {
  const frameRate = options.frameRate ?? DEFAULT_FRAME_RATE;
  const frames = options.anticipationFrames ?? DEFAULT_ANTICIPATION_FRAMES;
  if (!(frameRate > 0) || frames < 0) {
    throw new Error("Invalid anticipation settings");
  }
  return frames / frameRate;
}

export function applyAnticipation(
  cues: readonly Cue[],
  protectedTimes: readonly number[],
  options: AnticipationOptions = {},
): Cue[] {
  const lead = anticipationLeadSeconds(options);
  const protectedSet = new Set(protectedTimes);
  const result: Cue[] = [];
  for (const cue of [...cues].sort((a, b) => a.time - b.time)) {
    const shifts = cue.shape === "MBP" || cue.shape === "OO/W";
    if (!shifts || protectedSet.has(cue.time)) {
      result.push({ time: cue.time, shape: cue.shape });
      continue;
    }
    const shifted = Math.max(0, cue.time - lead);
    const previous = result.at(-1);
    if (previous !== undefined && previous.time >= shifted) {
      result.push({ time: cue.time, shape: cue.shape });
      continue;
    }
    result.push({ time: shifted, shape: cue.shape });
  }
  return result.sort((a, b) => a.time - b.time);
}
