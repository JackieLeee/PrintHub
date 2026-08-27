import { parseEscPosInspector } from "@virt-printer/escpos";
import { renderReceipt, renderReceiptToCanvas } from "./canvas-renderer.js";
import { receiptFontFamily } from "./receipt-fonts.js";
import { normalizeReceiptLayout } from "./receipt-layout.js";
import type { RenderOptions } from "./types.js";

const DEFAULT_RECEIPT_WIDTH = 384;

export interface EscPosPreviewResult {
  imageDataUrl: string;
  paperWidth: number;
  warnings: string[];
}

/** @deprecated Use EscPosPreviewResult; compare URLs are always null. */
export interface EscPosComparePreviewResult extends EscPosPreviewResult {
  textImageUrl: null;
  rasterImageUrl: null;
  hasRaster: boolean;
}

/** Match EscPosInspector: render to PNG data URL for `<img>` display. */
export async function renderEscPosPreview(
  payload: Uint8Array,
  options: RenderOptions = {},
): Promise<EscPosPreviewResult> {
  const widthPx = options.widthPx ?? DEFAULT_RECEIPT_WIDTH;
  const { commands, paperWidth, warnings } = parseEscPosInspector(payload, widthPx);
  const fontFamily = receiptFontFamily(options.receiptFontId);
  const layout = normalizeReceiptLayout(options.receiptLayout);
  const result = await renderReceipt(commands, paperWidth, { fontFamily, layout });
  return {
    imageDataUrl: result.imageDataUrl,
    paperWidth,
    warnings,
  };
}

/** @deprecated Side-by-side compare removed; returns the same unified preview. */
export async function renderEscPosComparePreview(
  payload: Uint8Array,
  options: RenderOptions = {},
): Promise<EscPosComparePreviewResult> {
  const preview = await renderEscPosPreview(payload, options);
  const widthPx = options.widthPx ?? DEFAULT_RECEIPT_WIDTH;
  const { commands } = parseEscPosInspector(payload, widthPx);
  const hasRaster = commands.some(
    (c) => c.category === "image" || c.category === "rasterImage",
  );
  return {
    ...preview,
    textImageUrl: null,
    rasterImageUrl: null,
    hasRaster,
  };
}

export async function renderEscPosToCanvas(
  payload: Uint8Array,
  options: RenderOptions = {},
): Promise<HTMLCanvasElement> {
  const widthPx = options.widthPx ?? DEFAULT_RECEIPT_WIDTH;
  const { commands, paperWidth } = parseEscPosInspector(payload, widthPx);
  const fontFamily = receiptFontFamily(options.receiptFontId);
  const layout = normalizeReceiptLayout(options.receiptLayout);
  return renderReceiptToCanvas(commands, paperWidth, { fontFamily, layout });
}
