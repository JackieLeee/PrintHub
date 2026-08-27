/** True when a 1-bpp bitmap buffer contains no printed dots (all bytes zero). */
export function isBlankBitmap(data: Uint8Array): boolean {
  for (const b of data) {
    if (b !== 0) return false;
  }
  return true;
}

/** Fast scan for raster/image ESC/POS sequences without full parse/decode. */
export function payloadHasRaster(data: Uint8Array): boolean {
  for (let i = 0; i < data.length - 2; i++) {
    if (data[i] === 0x1b && data[i + 1] === 0x2a) return true;

    if (
      data[i] === 0x1d &&
      data[i + 1] === 0x76 &&
      i + 2 < data.length &&
      data[i + 2] === 0x30
    ) {
      return true;
    }

    if (
      data[i] === 0x1d &&
      data[i + 1] === 0x28 &&
      i + 5 < data.length &&
      data[i + 2] === 0x4c &&
      data[i + 5] === 0x70
    ) {
      return true;
    }
  }
  return false;
}
