export const PAUSE_ONLY_SAMPLE_RATE = 22050;
export const PAUSE_ONLY_CHANNELS = 1;

export type SpeechPcm = {
  type: "speech";
  pcm16: Uint8Array;
  sampleRate: number;
  channels: number;
};

export type SilencePcm = {
  type: "silence";
  seconds: number;
};

export function splicePcm16(parts: readonly (SpeechPcm | SilencePcm)[]): {
  pcm16: Uint8Array;
  sampleRate: number;
  channels: number;
} {
  const speech = parts.find(
    (part): part is SpeechPcm => part.type === "speech",
  );
  const sampleRate = speech?.sampleRate ?? PAUSE_ONLY_SAMPLE_RATE;
  const channels = speech?.channels ?? PAUSE_ONLY_CHANNELS;
  if (!(sampleRate > 0) || !Number.isInteger(channels) || channels <= 0) {
    throw new Error("Invalid PCM format");
  }
  const bytesPerFrame = channels * 2;
  const chunks: Uint8Array[] = [];
  for (const part of parts) {
    if (part.type === "speech") {
      if (part.sampleRate !== sampleRate || part.channels !== channels) {
        throw new Error(
          "PCM segments disagree on sample rate or channel count",
        );
      }
      if (part.pcm16.byteLength % bytesPerFrame !== 0) {
        throw new Error("PCM byte length is not a whole number of frames");
      }
      chunks.push(part.pcm16);
      continue;
    }
    if (part.seconds < 0) throw new Error("Negative silence");
    const frames = Math.round(part.seconds * sampleRate);
    chunks.push(new Uint8Array(frames * bytesPerFrame));
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const pcm16 = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    pcm16.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { pcm16, sampleRate, channels };
}
