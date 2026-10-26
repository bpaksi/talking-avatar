export type WebpInfo = {
  width: number;
  height: number;
  /** VP8X alpha flag, or a VP8L stream that declares alpha. Simple lossy VP8 has none. */
  hasAlpha: boolean;
};

function tag(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );
}

function u24(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16)
  );
}

/** Reads a WebP's size and alpha from its header; `null` when the bytes are not a WebP. */
export function readWebpInfo(bytes: Uint8Array): WebpInfo | null {
  if (bytes.length < 30) return null;
  if (tag(bytes, 0) !== "RIFF" || tag(bytes, 8) !== "WEBP") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const format = tag(bytes, 12);
  if (format === "VP8X") {
    return {
      width: 1 + u24(bytes, 24),
      height: 1 + u24(bytes, 27),
      hasAlpha: ((bytes[20] ?? 0) & 0x10) !== 0,
    };
  }
  if (format === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const bits = view.getUint32(21, true);
    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >>> 14) & 0x3fff),
      hasAlpha: ((bits >>> 28) & 1) === 1,
    };
  }
  if (format === "VP8 ") {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      return null;
    }
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
      hasAlpha: false,
    };
  }
  return null;
}
