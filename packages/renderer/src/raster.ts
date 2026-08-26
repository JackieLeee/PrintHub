/** Draw 1-bit ESC/POS raster (MSB first, top row first). */
export function drawRasterBitmap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  widthBytes: number,
  height: number,
  data: Uint8Array,
  scale: number,
  color = "#111111",
): number {
  const widthPx = widthBytes * 8 * scale;
  const heightPx = height * scale;
  ctx.fillStyle = color;

  for (let row = 0; row < height; row++) {
    for (let colByte = 0; colByte < widthBytes; colByte++) {
      const byte = data[row * widthBytes + colByte] ?? 0;
      for (let bit = 0; bit < 8; bit++) {
        if ((byte & (0x80 >> bit)) !== 0) {
          ctx.fillRect(x + (colByte * 8 + bit) * scale, y + row * scale, scale, scale);
        }
      }
    }
  }

  return heightPx;
}

export function drawBitImageColumn(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  data: Uint8Array,
  scale: number,
  color = "#111111",
): number {
  const bytesPerCol = Math.max(1, Math.floor(data.length / width));
  ctx.fillStyle = color;

  for (let col = 0; col < width; col++) {
    for (let row = 0; row < height; row++) {
      const byteIndex = col * bytesPerCol + Math.floor(row / 8);
      const bit = 7 - (row % 8);
      const byte = data[byteIndex] ?? 0;
      if ((byte & (1 << bit)) !== 0) {
        ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
      }
    }
  }

  return height * scale;
}

/** ESC * column-format stripes stacked vertically (MSB = top dot). */
export function drawEscStarStripes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  bands: { height: number; data: Uint8Array }[],
  scale: number,
  color = "#111111",
): number {
  ctx.fillStyle = color;
  let yOffset = 0;

  for (const band of bands) {
    const bytesPerCol = band.height / 8;
    for (let col = 0; col < width; col++) {
      for (let dot = 0; dot < band.height; dot++) {
        const byteIndex = col * bytesPerCol + (dot >> 3);
        const bit = 7 - (dot & 7);
        const byte = band.data[byteIndex] ?? 0;
        if ((byte & (1 << bit)) !== 0) {
          ctx.fillRect(x + col * scale, y + (yOffset + dot) * scale, scale, scale);
        }
      }
    }
    yOffset += band.height;
  }

  return yOffset * scale;
}
