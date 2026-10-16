export type PngInfo = {
  width: number;
  height: number;
  /** Colour type with alpha (4 or 6), or a `tRNS` chunk before the image data. */
  hasAlpha: boolean;
};

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function chunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + 4));
}

/** Reads a PNG's size and alpha from its header chunks; `null` when the bytes are not a PNG. */
export function readPngInfo(bytes: Uint8Array): PngInfo | null {
  if (bytes.length < 33) return null;
  if (SIGNATURE.some((byte, index) => bytes[index] !== byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (chunkType(bytes, 12) !== "IHDR") return null;
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const colourType = bytes[25];
  let hasAlpha = colourType === 4 || colourType === 6;
  let offset = 8;
  while (!hasAlpha && offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = chunkType(bytes, offset + 4);
    if (type === "IDAT" || type === "IEND") break;
    if (type === "tRNS") hasAlpha = true;
    offset += 12 + length;
  }
  return { width, height, hasAlpha };
}
