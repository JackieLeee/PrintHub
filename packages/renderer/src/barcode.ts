import QRCode from "qrcode";
import { drawCode128, code128WidthDots } from "./code128.js";
import { drawQrMatrix, qrEcLevelFromByte, qrModulePx } from "./qr-encode.js";

export type TsplHriPosition = "none" | "above" | "below";

/** Draw TSPL BARCODE command preview (Code 128 and simplified fallback). */
export function drawTsplBarcodePreview(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  format: string,
  height: number,
  data: string,
  hri: TsplHriPosition,
  narrow: number,
  _wide: number,
  color = "#111111",
): number {
  const fmt = format.replace(/"/g, "").toLowerCase();
  if (fmt === "128" || fmt === "code128") {
    return drawCode128(ctx, x, y, data, height, narrow, color, hri);
  }

  // Fallback: proportional placeholder for unsupported symbologies.
  const barWidth = Math.max(data.length * narrow * 11, narrow * 40);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, barWidth, height);
  let stripeX = x + narrow;
  while (stripeX < x + barWidth - narrow) {
    const stripeW = narrow + (stripeX % (narrow * 3));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(stripeX, y, stripeW, height);
    stripeX += stripeW + narrow;
    ctx.fillStyle = color;
  }
  if (hri !== "none") {
    const hriSize = Math.max(10, narrow * 3);
    ctx.font = `${hriSize}px "Courier New", Courier, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = hri === "above" ? "bottom" : "top";
    ctx.fillText(data, x + barWidth / 2, hri === "above" ? y - 2 : y + height + 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    return height + hriSize + 4;
  }
  return height;
}

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

export type EscPosHriPosition = "none" | "above" | "below" | "both";

function mapEscPosHri(position: string): EscPosHriPosition {
  if (position === "above" || position === "1") return "above";
  if (position === "both" || position === "3") return "both";
  if (position === "none" || position === "0") return "none";
  return "below";
}

function isCode128Symbology(symbology: string): boolean {
  const s = symbology.toLowerCase();
  return s.includes("128") || s === "gs1-128" || s === "code128";
}

/** Draw ESC/POS GS k barcode preview; Code 128 uses real encoding. */
export function drawEscPosBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  symbology: string,
  data: string,
  height: number,
  narrow: number,
  hri: string,
  maxWidth: number,
  color = "#111111",
): number {
  const barHeight = height > 0 ? height : 80;
  const module = Math.max(1, narrow > 0 ? narrow : 2);
  const hriPos = mapEscPosHri(hri);

  if (isCode128Symbology(symbology)) {
    const barWidth = code128WidthDots(data, module);
    if (barWidth <= maxWidth) {
      return drawCode128(ctx, x, y, data, barHeight, module, color, hriPos === "both" ? "below" : hriPos);
    }
    const scale = maxWidth / barWidth;
    const scaledModule = Math.max(1, module * scale);
    return drawCode128(ctx, x, y, data, barHeight, scaledModule, color, hriPos === "both" ? "below" : hriPos);
  }

  return drawBarcodePreview(ctx, x, y, Math.min(maxWidth, 220), data, color);
}

export { drawQrMatrix, qrEcLevelFromByte, qrModulePx };

export type QrEcLevel = "L" | "M" | "Q" | "H";

function mapEscPosHriForLayout(position: string): EscPosHriPosition {
  return mapEscPosHri(position);
}

/** Layout height for ESC/POS barcode element (matches drawEscPosBarcode). */
export function escPosBarcodeLayoutHeight(
  symbology: string,
  data: string,
  height: number,
  narrow: number,
  hri: string,
): number {
  const barHeight = height > 0 ? height : 80;
  const hriPos = mapEscPosHriForLayout(hri);
  const hriExtra = hriPos !== "none" && data.length > 0 ? 18 : 0;
  if (isCode128Symbology(symbology)) {
    return barHeight + hriExtra;
  }
  return 48 + 22;
}

/** Layout size for ESC/POS QR element (matches drawQrMatrix). */
export function qrLayoutSize(
  data: string,
  moduleSize: number,
  ecLevel: QrEcLevel = "M",
  paperWidthPx = 576,
): { width: number; height: number } {
  if (!data) return { width: 0, height: 0 };
  const cell = qrModulePx(moduleSize, data, paperWidthPx, ecLevel);
  const qr = QRCode.create(data, { errorCorrectionLevel: ecLevel });
  const n = qr.modules.size;
  const size = n * cell;
  return { width: size, height: size + 8 };
}
