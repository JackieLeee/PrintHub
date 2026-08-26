import { parseEscPosInspector } from "@virt-printer/escpos";
import { renderReceipt, renderReceiptToCanvas } from "./canvas-renderer.js";
import type { RenderOptions } from "./types.js";

const DEFAULT_RECEIPT_WIDTH = 384;

export interface EscPosPreviewResult {
  imageDataUrl: string;
  paperWidth: number;
  warnings: string[];
}

/** Match EscPosInspector: render to PNG data URL for `<img>` display. */
export async function renderEscPosPreview(
  payload: Uint8Array,
  options: RenderOptions = {},
): Promise<EscPosPreviewResult> {
  const widthPx = options.widthPx ?? DEFAULT_RECEIPT_WIDTH;
  const { commands, paperWidth, warnings } = parseEscPosInspector(payload, widthPx);
  const result = await renderReceipt(commands, paperWidth);
  return { imageDataUrl: result.imageDataUrl, paperWidth, warnings };
}

export async function renderEscPosToCanvas(
  payload: Uint8Array,
  options: RenderOptions = {},
): Promise<HTMLCanvasElement> {
  const widthPx = options.widthPx ?? DEFAULT_RECEIPT_WIDTH;
  const { commands, paperWidth } = parseEscPosInspector(payload, widthPx);
  return renderReceiptToCanvas(commands, paperWidth);
}
