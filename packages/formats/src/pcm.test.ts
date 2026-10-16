import { describe, expect, it } from "vitest";

import { splicePcm16 } from "./pcm.js";

describe("pause silence", () => {
  it("inserts zero PCM frames for the pause and keeps the spoken bytes", () => {
    const speech = new Uint8Array([1, 2, 3, 4]);
    const spliced = splicePcm16([
      { type: "speech", pcm16: speech, sampleRate: 22050, channels: 1 },
      { type: "silence", seconds: 0.5 },
      {
        type: "speech",
        pcm16: new Uint8Array([5, 6]),
        sampleRate: 22050,
        channels: 1,
      },
    ]);
    expect(spliced.sampleRate).toBe(22050);
    expect(spliced.channels).toBe(1);
    expect(spliced.pcm16.byteLength).toBe(4 + 11025 * 2 + 2);
    expect(spliced.pcm16.subarray(0, 4)).toEqual(speech);
    expect(
      spliced.pcm16.subarray(4, 4 + 11025 * 2).every((byte) => byte === 0),
    ).toBe(true);
    expect(spliced.pcm16.subarray(spliced.pcm16.byteLength - 2)).toEqual(
      new Uint8Array([5, 6]),
    );
  });

  it("uses 22050 Hz mono when the line is only silence", () => {
    const spliced = splicePcm16([{ type: "silence", seconds: 0.5 }]);
    expect(spliced).toEqual({
      pcm16: new Uint8Array(11025 * 2),
      sampleRate: 22050,
      channels: 1,
    });
  });

  it("rejects segments that disagree", () => {
    expect(() =>
      splicePcm16([
        {
          type: "speech",
          pcm16: new Uint8Array(2),
          sampleRate: 22050,
          channels: 1,
        },
        {
          type: "speech",
          pcm16: new Uint8Array(4),
          sampleRate: 44100,
          channels: 1,
        },
      ]),
    ).toThrow(/disagree/);
  });
});
