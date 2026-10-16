import type { Cue } from "./rhubarb.js";
import type { ShapeId } from "./shapes.js";

export function shapeAt(cues: readonly Cue[], time: number): ShapeId {
  let lo = 0;
  let hi = cues.length - 1;
  let found: ShapeId = "REST";
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cue = cues[mid];
    if (cue === undefined) break;
    if (cue.time <= time) {
      found = cue.shape;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function visibleShape(args: {
  cues: readonly Cue[];
  time: number;
  audioAvailable: boolean;
  reducedMotion: boolean;
}): ShapeId {
  if (!args.audioAvailable || args.reducedMotion) return "REST";
  return shapeAt(args.cues, args.time);
}

export function sampleAudioClock(audio: { currentTime: number }): number {
  return audio.currentTime;
}
