/** QR layout/draw size aligned with EscPosInspector placeholder. */
export function qrPixelSize(qrModuleSize: number): number {
  const modules = 21 + (qrModuleSize - 1) * 4;
  const modulePx = Math.max(3, Math.floor(120 / modules));
  return modules * modulePx;
}

/** Simplified barcode placeholder (EscPosInspector-style wide stripe block). */
export function drawBarcodePreview(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  barWidth: number,
  data: string,
  color = "#111111",
): number {
  const height = 48;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, barWidth, height);

  let stripeX = x + 4;
  while (stripeX < x + barWidth - 4) {
    const stripeW = 2 + (stripeX % 5);
    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(stripeX, y + 4, stripeW, height - 8);
    stripeX += stripeW + 2;
  }

  ctx.fillStyle = "#222";
  ctx.font = '11px "Courier New", Courier, monospace';
  ctx.textAlign = "center";
  ctx.fillText(data, x + barWidth / 2, y + height + 14);
  ctx.textAlign = "left";

  return height + 22;
}

/** Deterministic QR-like grid preview (EscPosInspector-style, not scannable). */
export function drawQrPreview(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  qrModuleSize: number,
  data: string,
  color = "#111111",
): number {
  const modules = 21 + (qrModuleSize - 1) * 4;
  const modulePx = Math.max(3, Math.floor(120 / modules));
  const qrSize = modules * modulePx;

  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, qrSize, qrSize);
  ctx.fillStyle = color;

  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      const inFinder =
        (row < 7 && col < 7) ||
        (row < 7 && col >= modules - 7) ||
        (row >= modules - 7 && col < 7);
      const hash = (row * 17 + col * 31 + data.length) % 5;
      if (inFinder || hash > 1) {
        ctx.fillRect(x + col * modulePx, y + row * modulePx, modulePx, modulePx);
      }
    }
  }

  return qrSize + 8;
}
