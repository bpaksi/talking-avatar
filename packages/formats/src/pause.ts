const MARKER = /\[pause[^\]]*\]?/gi;
const VALID_MARKER = /^\[pause\s+([0-9]+(?:\.[0-9]+)?)\]$/;

export class PauseMarkupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PauseMarkupError";
  }
}

export type PauseSegment =
  | { type: "speech"; text: string }
  | { type: "pause"; seconds: number };

export function parseLineText(text: string): PauseSegment[] {
  const segments: PauseSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(MARKER)) {
    const raw = match[0];
    const index = match.index ?? 0;
    const speech = text.slice(cursor, index).trim();
    if (speech.length > 0) segments.push({ type: "speech", text: speech });
    const valid = VALID_MARKER.exec(raw);
    const seconds = valid?.[1];
    if (seconds === undefined) {
      throw new PauseMarkupError(`Invalid pause marker: ${raw}`);
    }
    segments.push({ type: "pause", seconds: Number(seconds) });
    cursor = index + raw.length;
  }
  const tail = text.slice(cursor).trim();
  if (/\[pause/i.test(tail)) {
    throw new PauseMarkupError("Unclosed pause marker");
  }
  if (tail.length > 0) segments.push({ type: "speech", text: tail });
  return segments;
}

export function spokenSegments(text: string): string[] {
  return parseLineText(text).flatMap((segment) =>
    segment.type === "speech" ? [segment.text] : [],
  );
}

export function dialogFileText(text: string): string {
  return spokenSegments(text).join(" ");
}

export type TtsRequest = {
  text: string;
  voiceId: string;
  style?: string;
};

export function ttsRequests(
  lineText: string,
  voice: { voiceId: string; style?: string },
): TtsRequest[] {
  return spokenSegments(lineText).map((text) => {
    const request: TtsRequest = { text, voiceId: voice.voiceId };
    if (voice.style !== undefined) request.style = voice.style;
    return request;
  });
}

export type AudioSplice =
  | { type: "speech"; text: string }
  | { type: "silence"; seconds: number };

export function audioSplicePlan(text: string): AudioSplice[] {
  return parseLineText(text).map((segment) =>
    segment.type === "speech"
      ? { type: "speech", text: segment.text }
      : { type: "silence", seconds: segment.seconds },
  );
}
