import { type AnticipationOptions, applyAnticipation } from "./anticipation.js";
import { applyOverrides, type OverridesFile } from "./overrides.js";
import { mapRhubarbJson, type RhubarbJson } from "./rhubarb.js";

export function buildCueTrack(
  rhubarb: RhubarbJson,
  overrides: OverridesFile | null,
  options: AnticipationOptions & { hasL: boolean },
): ReturnType<typeof mapRhubarbJson> {
  const mapped = mapRhubarbJson(rhubarb, { hasL: options.hasL });
  const file = overrides ?? { cues: [], remove: [] };
  const merged = applyOverrides(mapped, file);
  const removed = new Set(file.remove);
  const protectedTimes = file.cues
    .filter((cue) => !removed.has(cue.time))
    .map((cue) => cue.time);
  return applyAnticipation(merged, protectedTimes, options);
}
