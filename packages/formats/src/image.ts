import { readPngInfo } from "./png.js";
import { readWebpInfo } from "./webp.js";

export type ImageInfo = {
  width: number;
  height: number;
  hasAlpha: boolean;
};

/** Reads size and alpha of a PNG or WebP; `null` when the bytes are neither. */
export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  return readPngInfo(bytes) ?? readWebpInfo(bytes);
}
