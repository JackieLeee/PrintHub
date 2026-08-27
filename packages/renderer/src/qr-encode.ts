import QRCode from "qrcode";

export type QrEcLevel = "L" | "M" | "Q" | "H";

const EC_MAP: Record<number, QrEcLevel> = {
  0x30: "L",
  0x31: "M",
  0x32: "Q",
  0x33: "H",
};

export function qrEcLevelFromByte(ec: number): QrEcLevel {
  return EC_MAP[ec] ?? "M";
}

/** Draw scannable QR symbol; returns total height used. */
export function drawQrMatrix(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  data: string,
  modulePx: number,
  ecLevel: QrEcLevel = "M",
  color = "#111111",
): number {
  if (!data) return 0;

  const qr = QRCode.create(data, { errorCorrectionLevel: ecLevel });
  const n = qr.modules.size;
  const cell = Math.max(2, modulePx);
  const size = n * cell;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = color;

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.modules.get(row, col)) {
        ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
      }
    }
  }

  return size + 8;
}

/** ESC/POS module size (1–16) → preview pixel size per QR module. */
export function qrModulePx(
  moduleSize: number,
  data: string,
  paperWidthPx = 576,
  ecLevel: QrEcLevel = "M",
): number {
  if (!data) return 3;

  const qr = QRCode.create(data, { errorCorrectionLevel: ecLevel });
  const n = qr.modules.size;
  const dotsPerModule = Math.max(1, Math.min(16, moduleSize || 3));
  // On thermal preview, paper width px ≈ dot count at 203 DPI (48 cols × 12 dots = 576).
  const qrSideDots = n * dotsPerModule;
  const maxSide = Math.max(96, paperWidthPx - 32);
  const minSide = Math.min(maxSide, 120);
  const side = Math.max(minSide, Math.min(maxSide, qrSideDots));
  return Math.max(2, Math.floor(side / n));
}
