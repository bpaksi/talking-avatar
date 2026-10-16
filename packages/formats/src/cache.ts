export type TtsCacheInput = {
  text: string;
  provider: string;
  voiceId: string;
  style?: string;
};

export function ttsCacheMaterial(input: TtsCacheInput): string {
  return JSON.stringify({
    text: input.text,
    provider: input.provider,
    voiceId: input.voiceId,
    style: input.style ?? null,
  });
}

export type TimingCacheInput = {
  text: string;
  audioHash: string;
  artHash: string;
  anticipationFrames: number;
  frameRate: number;
  rhubarbVersion: string;
  extendedShapes: "GX" | "GHX";
};

export function timingCacheMaterial(input: TimingCacheInput): string {
  return JSON.stringify({
    text: input.text,
    audioHash: input.audioHash,
    artHash: input.artHash,
    anticipationFrames: input.anticipationFrames,
    frameRate: input.frameRate,
    rhubarbVersion: input.rhubarbVersion,
    extendedShapes: input.extendedShapes,
  });
}
