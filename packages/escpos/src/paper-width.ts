/** Printable width in dots at 203 DPI — 58mm paper. */
export const PAPER_WIDTH_58MM = 384;
/** Printable width in dots at 203 DPI — 80mm paper. */
export const PAPER_WIDTH_80MM = 576;

export const COLS_58MM = 32;
export const COLS_80MM = 48;

export function isWideChar(ch: string): boolean {
  return ch.charCodeAt(0) >= 0x80;
}

/** Thermal printer column count (CJK = 2 columns). */
export function receiptCellCount(text: string): number {
  let cols = 0;
  for (const ch of text) cols += isWideChar(ch) ? 2 : 1;
  return cols;
}

export function columnsForPaperWidth(paperWidthPx: number): number {
  return paperWidthPx >= 512 ? COLS_80MM : COLS_58MM;
}

export function dotsPerColumn(paperWidthPx: number): number {
  return paperWidthPx / columnsForPaperWidth(paperWidthPx);
}

export function paperWidthFromMaxColumns(maxCols: number): number {
  if (maxCols > COLS_58MM) return PAPER_WIDTH_80MM;
  if (maxCols > 0) return PAPER_WIDTH_58MM;
  return PAPER_WIDTH_58MM;
}

/** Inline QR/logo graphics are much narrower than printable paper width. */
function isFullWidthRaster(widthPx: number): boolean {
  return widthPx >= PAPER_WIDTH_58MM - 32;
}

export function estimatePaperWidthFromRaster(widthPx: number): number {
  if (widthPx <= 0) return PAPER_WIDTH_58MM;
  if (widthPx <= 256) return 256;
  if (widthPx <= 400) return PAPER_WIDTH_58MM;
  if (widthPx <= 512) return 512;
  if (widthPx <= 576) return PAPER_WIDTH_80MM;
  return widthPx;
}

export interface PaperWidthHint {
  category: "text";
  text: string;
}

export interface RasterWidthHint {
  category: "image" | "rasterImage";
  width: number;
}

/** Infer printable paper width from parsed inspector commands. */
export function inferPaperWidthFromCommands(
  commands: Array<PaperWidthHint | RasterWidthHint | { category: string }>,
  fallback = PAPER_WIDTH_58MM,
): number {
  let maxRaster = 0;
  let maxCols = 0;

  for (const cmd of commands) {
    if (cmd.category === "text" && "text" in cmd) {
      for (const line of cmd.text.split("\n")) {
        maxCols = Math.max(maxCols, receiptCellCount(line));
      }
    }
    if (
      (cmd.category === "image" || cmd.category === "rasterImage") &&
      "width" in cmd &&
      typeof cmd.width === "number"
    ) {
      maxRaster = Math.max(maxRaster, cmd.width);
    }
  }

  if (maxRaster > 0) {
    const rasterPaper = estimatePaperWidthFromRaster(maxRaster);
    const textPaper = maxCols > 0 ? paperWidthFromMaxColumns(maxCols) : 0;
    if (isFullWidthRaster(maxRaster)) {
      return Math.max(rasterPaper, textPaper);
    }
    if (textPaper > 0) {
      return textPaper;
    }
    return rasterPaper;
  }
  if (maxCols > 0) {
    return paperWidthFromMaxColumns(maxCols);
  }
  return fallback;
}
