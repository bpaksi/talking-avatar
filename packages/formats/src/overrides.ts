import type { Cue } from "./rhubarb.js";
import type { ShapeId } from "./shapes.js";

export type OverridesFile = {
  cues: Cue[];
  remove: number[];
};

export function applyOverrides(
  track: readonly Cue[],
  file: OverridesFile,
): Cue[] {
  const byTime = new Map<number, ShapeId>();
  for (const cue of track) byTime.set(cue.time, cue.shape);
  for (const cue of file.cues) byTime.set(cue.time, cue.shape);
  for (const time of file.remove) byTime.delete(time);
  return [...byTime.entries()]
    .map(([time, shape]) => ({ time, shape }))
    .sort((a, b) => a.time - b.time);
}
