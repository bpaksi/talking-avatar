"use client";

export {
  sampleAudioClock,
  shapeAt,
  visibleShape,
} from "@talking-avatar/formats";
export { assetUrl, captionFor, mouthFiles } from "./assets.js";
export {
  type ClockAudio,
  createMouthClock,
  type FrameScheduler,
  letterAt,
  type MouthCue,
  REST_LETTER,
} from "./cues.js";
export { TalkingAvatar, type TalkingAvatarProps } from "./talking-avatar.js";
