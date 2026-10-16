import { describe, expect, it } from "vitest";

import {
  audioSplicePlan,
  dialogFileText,
  PauseMarkupError,
  spokenSegments,
  ttsRequests,
} from "./pause.js";

const SAMPLE = "Welcome. [pause 0.5] Follow me.";

describe("tts request text", () => {
  it("sends each spoken segment and never the pause markup", () => {
    const requests = ttsRequests(SAMPLE, {
      voiceId: "voice-1",
      style: "calm, warm",
    });
    expect(requests).toEqual([
      { text: "Welcome.", voiceId: "voice-1", style: "calm, warm" },
      { text: "Follow me.", voiceId: "voice-1", style: "calm, warm" },
    ]);
    expect(requests.every((request) => !request.text.includes("[pause"))).toBe(
      true,
    );
    expect(requests.every((request) => request.style === "calm, warm")).toBe(
      true,
    );
  });

  it("writes the Rhubarb dialog file from spoken words only", () => {
    expect(dialogFileText(SAMPLE)).toBe("Welcome. Follow me.");
    expect(dialogFileText(SAMPLE).includes("[pause")).toBe(false);
  });

  it("plans silence between the spoken segments", () => {
    expect(audioSplicePlan(SAMPLE)).toEqual([
      { type: "speech", text: "Welcome." },
      { type: "silence", seconds: 0.5 },
      { type: "speech", text: "Follow me." },
    ]);
    expect(spokenSegments("[pause 0.5] Only this. [pause 1]")).toEqual([
      "Only this.",
    ]);
    expect(dialogFileText("[pause 1]")).toBe("");
  });

  it("rejects markup that is not [pause N]", () => {
    expect(() => spokenSegments("Hi [pause]")).toThrow(PauseMarkupError);
    expect(() => spokenSegments("Hi [Pause 0.5]")).toThrow(PauseMarkupError);
    expect(() => spokenSegments("Hi [pause -1]")).toThrow(PauseMarkupError);
    expect(() => spokenSegments("Hi [pause 0.5")).toThrow(PauseMarkupError);
  });
});
