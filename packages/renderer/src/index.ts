import { renderEscPosToCanvas } from "./escpos-renderer.js";
import { renderTsplToCanvas } from "./tspl-renderer.js";

export type { RenderOptions } from "./types.js";
export type { EscPosPreviewResult, EscPosComparePreviewResult } from "./escpos-renderer.js";
export {
  renderEscPosPreview,
  renderEscPosComparePreview,
  renderEscPosToCanvas,
} from "./escpos-renderer.js";
export { renderTsplToCanvas } from "./tspl-renderer.js";
export { renderReceipt, renderReceiptToCanvas, buildRenderElements } from "./canvas-renderer.js";
export type { ReceiptRenderOptions } from "./canvas-renderer.js";
export {
  DEFAULT_RECEIPT_FONT_ID,
  RECEIPT_FONT_PRESETS,
  RECEIPT_FONT_PREVIEW_ORDER,
  nextReceiptFontId,
  prevReceiptFontId,
  receiptFontFamily,
  receiptFontLabel,
} from "./receipt-fonts.js";
export type { ReceiptFontId } from "./receipt-fonts.js";
export type { ReceiptLayoutTuning } from "./receipt-layout.js";
export {
  DEFAULT_RECEIPT_LAYOUT,
  normalizeReceiptLayout,
} from "./receipt-layout.js";
export {
  escPosHasRaster,
  escPosHasTextContent,
  filterEscPosCommands,
} from "./escpos-command-filter.js";
