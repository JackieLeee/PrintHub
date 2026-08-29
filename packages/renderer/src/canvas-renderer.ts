/**
 * Canvas receipt renderer — copied from amin-norollah/EscPosInspector (canvasRenderer.ts).
 */
import type {
  BarcodeCommand,
  ImageCommand,
  ParsedCommand,
  QrCodeCommand,
  RenderElement,
  RenderResult,
  TextCommand,
} from "@virt-printer/escpos";
import {
  columnsForPaperWidth,
  dotsPerColumn,
  isWideChar,
  receiptCellCount,
} from "@virt-printer/escpos";
import { DEFAULT_RECEIPT_FONT_ID, receiptFontFamily, RECEIPT_CJK_FONT, RECEIPT_LATIN_FONT } from "./receipt-fonts.js";
import {
  DEFAULT_RECEIPT_LAYOUT,
  normalizeReceiptLayout,
  type ReceiptLayoutTuning,
} from "./receipt-layout.js";
import {
  drawEscPosBarcode,
  drawQrMatrix,
  escPosBarcodeLayoutHeight,
  qrEcLevelFromByte,
  qrLayoutSize,
  qrModulePx,
  type QrEcLevel,
} from "./barcode.js";

export type { ReceiptLayoutTuning };
export { DEFAULT_RECEIPT_LAYOUT, normalizeReceiptLayout };

/** Epson default line spacing after ESC 2 (dots at 203 DPI). */
const DEFAULT_LINE_SPACING_DOTS = 30;

/** Font A cell width in dots at 203 DPI. */
const FONT_A_CELL_DOTS = 12;

/** Thermal Font A: cell width in dots; line height ~1.67× cell at 203 DPI. */
function lineHeightForPaper(charWidthPx: number): number {
  return Math.round(charWidthPx * (20 / 12));
}

function dotsToLayoutPx(dots: number, layoutCellWidth: number): number {
  return dots * (layoutCellWidth / FONT_A_CELL_DOTS);
}

export interface ReceiptRenderOptions {
  highlightCommandId?: string | null;
  fontFamily?: string;
  layout?: Partial<ReceiptLayoutTuning>;
}

const VERTICAL_PADDING = 16;
/** Outer margin; white receipt inset matches this. */
const PAPER_INSET = 8;

const DEFAULT_FONT = receiptFontFamily(DEFAULT_RECEIPT_FONT_ID);

interface LayoutMetrics {
  paperWidthPx: number;
  charWidthPx: number;
  canvasWidth: number;
}

function layoutMetrics(paperWidthPx: number): LayoutMetrics {
  const charWidthPx = dotsPerColumn(paperWidthPx);
  return {
    paperWidthPx,
    charWidthPx,
    canvasWidth: paperWidthPx + PAPER_INSET * 2,
  };
}

interface RenderState {
  alignment: "left" | "center" | "right";
  charWidthMul: number;
  charHeightMul: number;
  bold: boolean;
  underline: boolean;
  invert: boolean;
  pendingQrData: string;
  pendingQrSize: number;
  pendingQrEc: QrEcLevel;
  lineSpacingDots: number;
  cellWidthScale: number;
}

function textWidth(
  text: string,
  layoutCellWidth: number,
  charWidthMul: number,
): number {
  return receiptCellCount(text) * layoutCellWidth * charWidthMul;
}

function receiptFont(
  ctx: CanvasRenderingContext2D,
  fontSize: number,
  bold: boolean,
  latin: boolean,
): void {
  const weight = bold ? "600" : "400";
  const family = latin ? RECEIPT_LATIN_FONT : RECEIPT_CJK_FONT;
  ctx.font = `${weight} ${fontSize}px ${family}`;
}

function segmentPaperCols(seg: Pick<SegmentLike, "content" | "charWidthMul">): number {
  return receiptCellCount(seg.content) * (seg.charWidthMul ?? 1);
}

function receiptFontSize(
  layoutCellWidth: number,
  fontSizeScale: number,
  charHeightMul: number,
): number {
  return layoutCellWidth * fontSizeScale * charHeightMul;
}

function isDoubleCellChar(ch: string): boolean {
  return isWideChar(ch);
}

/** One thermal cell (12 dots); wide chars span 2 cells × 24 dots. */
function drawReceiptCellChar(
  ctx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  layoutCellWidth: number,
  charWidthMul: number,
  fontSizeScale: number,
  charHeightMul: number,
  bold: boolean,
): void {
  const wide = isDoubleCellChar(ch);
  const cells = (wide ? 2 : 1) * charWidthMul;
  const targetW = layoutCellWidth * cells;
  const fontPx = receiptFontSize(layoutCellWidth, fontSizeScale, charHeightMul);

  receiptFont(ctx, fontPx, bold, !wide);
  ctx.textBaseline = "top";
  ctx.save();
  ctx.translate(x, y);
  const gw = ctx.measureText(ch).width || layoutCellWidth;
  ctx.scale(targetW / gw, 1);
  ctx.fillText(ch, 0, 0);
  ctx.restore();
}

/** Every character occupies fixed column cells — matches ESC/POS Font A grid. */
function drawReceiptLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  layoutCellWidth: number,
  charWidthMul: number,
  charHeightMul: number,
  fontSizeScale: number,
  bold: boolean,
  _fontFamily: string,
): void {
  let col = 0;
  for (const ch of text) {
    if (ch === "\x00") continue;
    const span = (isDoubleCellChar(ch) ? 2 : 1) * charWidthMul;
    drawReceiptCellChar(
      ctx,
      ch,
      x + col * layoutCellWidth,
      y,
      layoutCellWidth,
      charWidthMul,
      fontSizeScale,
      charHeightMul,
      bold,
    );
    col += span;
  }
}

function measureReceiptLineWidth(
  text: string,
  layoutCellWidth: number,
  charWidthMul: number,
): number {
  return receiptCellCount(text) * layoutCellWidth * charWidthMul;
}

/** Merge multi-segment POS lines into one grid string (same as sequential printer output). */
export function mergeSegmentsToGridString(
  segments: Array<Pick<SegmentLike, "content" | "alignment">>,
  maxCols: number,
): string {
  const cells: string[] = Array(maxCols).fill(" ");
  for (let i = 0; i < segments.length; i++) {
    let col = segmentStartCol(segments, i, maxCols);
    for (const ch of segments[i]!.content) {
      if (col >= maxCols) break;
      const span = isWideChar(ch) ? 2 : 1;
      if (col + span > maxCols) break;
      cells[col] = ch;
      if (span === 2 && col + 1 < maxCols) cells[col + 1] = "\x00";
      col += span;
    }
  }
  let out = "";
  for (let c = 0; c < maxCols; c++) {
    const ch = cells[c]!;
    if (ch === "\x00") continue;
    out += ch;
  }
  return out;
}

function segmentsShareStyle(segments: PendingSegment[]): boolean {
  if (segments.length <= 1) return true;
  const first = segments[0]!;
  return segments.every(
    (s) =>
      s.bold === first.bold &&
      s.charWidthMul === first.charWidthMul &&
      s.charHeightMul === first.charHeightMul &&
      s.underline === first.underline &&
      s.invert === first.invert,
  );
}

interface SegmentLike {
  content: string;
  alignment: "left" | "center" | "right";
  charWidthMul: number;
  cellWidthScale?: number;
}

function segmentCellWidth(layoutCellWidth: number, seg: SegmentLike): number {
  return layoutCellWidth * (seg.cellWidthScale ?? 1);
}

/** Column index for multi-segment POS lines (space-padded fields + trailing right values). */
export function segmentStartCol(
  segments: Array<Pick<SegmentLike, "content" | "alignment" | "charWidthMul">>,
  index: number,
  maxCols: number,
): number {
  const seg = segments[index]!;
  const cols = segmentPaperCols(seg);
  if (seg.alignment === "right") {
    return Math.max(0, maxCols - cols);
  }
  let col = 0;
  for (let i = 0; i < index; i++) {
    if (segments[i]!.alignment !== "right") {
      col += segmentPaperCols(segments[i]!);
    }
  }
  return col;
}

function segmentDrawX(
  seg: SegmentLike,
  index: number,
  segments: SegmentLike[],
  paperWidthPx: number,
  layoutCellWidth: number,
): number {
  const cellW = segmentCellWidth(layoutCellWidth, seg);
  if (segments.length === 1) {
    const width = textWidth(seg.content, cellW, seg.charWidthMul);
    return alignX(width, paperWidthPx, seg.alignment);
  }
  const maxCols = Math.round(columnsForPaperWidth(paperWidthPx) / (seg.cellWidthScale ?? 1));
  const startCol = segmentStartCol(segments, index, maxCols);
  return PAPER_INSET + startCol * cellW * seg.charWidthMul;
}

function alignX(
  contentWidth: number,
  paperWidthPx: number,
  alignment: "left" | "center" | "right",
): number {
  if (alignment === "center") return PAPER_INSET + Math.max(0, (paperWidthPx - contentWidth) / 2);
  if (alignment === "right") return PAPER_INSET + Math.max(0, paperWidthPx - contentWidth);
  return PAPER_INSET;
}

/** Apply GS ( k setup commands; ignore placeholder fields on Print/store rows. */
function applyQrPendingState(state: RenderState, qrCmd: QrCodeCommand): void {
  switch (qrCmd.label) {
    case "QR Code Size":
      state.pendingQrSize = qrCmd.size;
      break;
    case "QR Error Correction":
      state.pendingQrEc = qrEcLevelFromByte(qrCmd.errorCorrection);
      break;
    case "QR Code":
      if (qrCmd.data) state.pendingQrData = qrCmd.data;
      break;
    default:
      break;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

interface PendingSegment {
  commandId: string;
  content: string;
  alignment: "left" | "center" | "right";
  fontSize: number;
  charWidthMul: number;
  charHeightMul: number;
  bold: boolean;
  underline: boolean;
  invert: boolean;
  cellWidthScale: number;
}

export function buildRenderElements(
  commands: ParsedCommand[],
  paperWidthPx: number,
  layoutTuning: ReceiptLayoutTuning = DEFAULT_RECEIPT_LAYOUT,
): RenderElement[] {
  const { charWidthPx } = layoutMetrics(paperWidthPx);
  /** Column grid matches paper dots (48×12=576); not scaled by fontSizeScale. */
  const layoutCellWidth = charWidthPx;
  const lineHeight = lineHeightForPaper(charWidthPx) * layoutTuning.lineHeightScale;
  const elements: RenderElement[] = [];
  const state: RenderState = {
    alignment: "left",
    charWidthMul: 1,
    charHeightMul: 1,
    bold: false,
    underline: false,
    invert: false,
    pendingQrData: "",
    pendingQrSize: 3,
    pendingQrEc: "M",
    lineSpacingDots: DEFAULT_LINE_SPACING_DOTS,
    cellWidthScale: 1,
  };

  let y = VERTICAL_PADDING;
  let pendingSegments: PendingSegment[] = [];

  const effectiveCellWidth = () => layoutCellWidth * state.cellWidthScale;

  const spacingAdvancePx = () => dotsToLayoutPx(state.lineSpacingDots, layoutCellWidth);

  const lineAdvancePx = (charHeightMul = state.charHeightMul) => {
    const spacingPx = spacingAdvancePx();
    const fontPx = lineHeight * charHeightMul;
    return Math.max(spacingPx, fontPx);
  };

  const addVerticalGap = (heightPx: number, commandId?: string) => {
    if (heightPx <= 0) return;
    if (commandId) {
      elements.push({
        commandId,
        type: "feed",
        y,
        height: heightPx,
      });
    }
    y += heightPx;
  };

  const flushLogicalLine = (feedCommandId?: string, feedLineCount = 1) => {
    if (pendingSegments.length === 0) {
      if (feedCommandId && feedLineCount > 0) {
        addVerticalGap(spacingAdvancePx() * feedLineCount, feedCommandId);
      }
      return;
    }

    const height =
      lineHeight * Math.max(...pendingSegments.map((s) => s.charHeightMul));
    const advance = Math.max(height, lineAdvancePx(Math.max(...pendingSegments.map((s) => s.charHeightMul))));

    if (pendingSegments.length > 1 && segmentsShareStyle(pendingSegments)) {
      const maxCols = Math.round(columnsForPaperWidth(paperWidthPx) / state.cellWidthScale);
      const merged = mergeSegmentsToGridString(pendingSegments, maxCols);
      const seg = pendingSegments[0]!;
      const cellW = effectiveCellWidth();
      elements.push({
        commandId: seg.commandId,
        type: "text",
        y,
        height,
        x: PAPER_INSET,
        width: textWidth(merged, cellW, seg.charWidthMul),
        content: merged,
        alignment: "left",
        fontSize: cellW,
        charWidthMul: seg.charWidthMul,
        charHeightMul: seg.charHeightMul,
        bold: seg.bold,
        underline: seg.underline,
        invert: seg.invert,
        mergedCommandIds: pendingSegments.map((s) => s.commandId),
      });
    } else {
      for (let i = 0; i < pendingSegments.length; i++) {
        const seg = pendingSegments[i]!;
        const displayContent =
          pendingSegments.length > 1 && seg.alignment !== "right"
            ? seg.content.trimEnd()
            : seg.content;
        const cellW = layoutCellWidth * seg.cellWidthScale;
        const width = textWidth(displayContent, cellW, seg.charWidthMul);
        const x = segmentDrawX(seg, i, pendingSegments, paperWidthPx, layoutCellWidth);
        elements.push({
          commandId: seg.commandId,
          type: "text",
          y,
          height,
          x,
          width,
          content: displayContent,
          alignment: seg.alignment,
          fontSize: cellW,
          charWidthMul: seg.charWidthMul,
          charHeightMul: seg.charHeightMul,
          bold: seg.bold,
          underline: seg.underline,
          invert: seg.invert,
        });
      }
    }
    y += advance;
    pendingSegments = [];
  };

  const appendText = (text: string, commandId: string) => {
    const parts = text.split("\n");
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (part.length > 0) {
        pendingSegments.push({
          commandId,
          content: part,
          alignment: state.alignment,
          fontSize: effectiveCellWidth(),
          charWidthMul: state.charWidthMul,
          charHeightMul: state.charHeightMul,
          bold: state.bold,
          underline: state.underline,
          invert: state.invert,
          cellWidthScale: state.cellWidthScale,
        });
      }
      if (i < parts.length - 1) {
        flushLogicalLine();
      }
    }
    if (text.endsWith("\n")) {
      flushLogicalLine();
    }
  };

  for (const command of commands) {
    switch (command.category) {
      case "initialize":
        state.alignment = "left";
        state.charWidthMul = 1;
        state.charHeightMul = 1;
        state.bold = false;
        state.underline = false;
        state.invert = false;
        state.lineSpacingDots = DEFAULT_LINE_SPACING_DOTS;
        state.cellWidthScale = 1;
        state.pendingQrData = "";
        state.pendingQrSize = 3;
        state.pendingQrEc = "M";
        break;
      case "alignment":
        state.alignment = command.alignment;
        break;
      case "font":
        state.charWidthMul = command.width;
        state.charHeightMul = command.height;
        state.bold = command.bold;
        state.underline = command.underline;
        if (command.cellWidthScale !== undefined) {
          state.cellWidthScale = command.cellWidthScale;
        }
        break;
      case "style":
        if (command.bold !== undefined) state.bold = command.bold;
        if (command.underline !== undefined) state.underline = command.underline;
        if (command.invert !== undefined) state.invert = command.invert;
        break;
      case "text":
        appendText((command as TextCommand).text, command.id);
        break;
      case "lineSpacing":
        state.lineSpacingDots =
          command.spacing === null ? DEFAULT_LINE_SPACING_DOTS : command.spacing;
        break;
      case "lineFeed":
        flushLogicalLine(command.id, 1);
        break;
      case "feed": {
        flushLogicalLine();
        const feed = command;
        if (feed.unit === "dots") {
          addVerticalGap(dotsToLayoutPx(feed.lines, layoutCellWidth), command.id);
        } else {
          addVerticalGap(spacingAdvancePx() * feed.lines, command.id);
        }
        break;
      }
      case "image":
      case "rasterImage": {
        const imageCmd = command as ImageCommand;
        const displayWidth = Math.min(imageCmd.width, paperWidthPx);
        const displayHeight =
          imageCmd.width > 0 ? Math.round((imageCmd.height / imageCmd.width) * displayWidth) : 0;
        const x = alignX(displayWidth, paperWidthPx, state.alignment);
        elements.push({
          commandId: command.id,
          type: "image",
          y,
          height: displayHeight + 8,
          x,
          width: displayWidth,
          imageDataUrl: imageCmd.imageDataUrl,
          alignment: state.alignment,
        });
        y += displayHeight + 8;
        break;
      }
      case "barcode": {
        const barcodeCmd = command as BarcodeCommand;
        const width = Math.min(paperWidthPx, 240);
        const x = alignX(width, paperWidthPx, state.alignment);
        const layoutHeight = escPosBarcodeLayoutHeight(
          barcodeCmd.symbology,
          barcodeCmd.data,
          barcodeCmd.height,
          barcodeCmd.width,
          barcodeCmd.position,
        );
        elements.push({
          commandId: command.id,
          type: "barcode",
          y,
          height: layoutHeight,
          x,
          width,
          content: barcodeCmd.data,
          alignment: state.alignment,
        });
        y += layoutHeight;
        break;
      }
      case "qrCode": {
        const qrCmd = command as QrCodeCommand;
        applyQrPendingState(state, qrCmd);
        if (qrCmd.label === "Print QR Code") {
          const { width: qrWidth, height: qrHeight } = qrLayoutSize(
            state.pendingQrData,
            state.pendingQrSize,
            state.pendingQrEc,
            paperWidthPx,
          );
          const x = alignX(qrWidth, paperWidthPx, state.alignment);
          elements.push({
            commandId: command.id,
            type: "qr",
            y,
            height: qrHeight,
            x,
            width: qrWidth,
            content: state.pendingQrData,
            alignment: state.alignment,
          });
          y += qrHeight;
        }
        break;
      }
      case "cut":
        elements.push({ commandId: command.id, type: "cut", y, height: 24 });
        y += 24;
        break;
      case "cashDrawer": {
        const drawerH = 36;
        elements.push({
          commandId: command.id,
          type: "cashDrawer",
          y,
          height: drawerH,
          x: PAPER_INSET,
          width: paperWidthPx,
          content: `pin ${command.pin}`,
        });
        y += drawerH + 4;
        break;
      }
      default:
        break;
    }
  }

  if (pendingSegments.length > 0) {
    flushLogicalLine();
  }

  return elements;
}

async function ensureReceiptFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  const loads = [
    document.fonts.load(`400 12px ${RECEIPT_LATIN_FONT}`),
    document.fonts.load(`600 12px ${RECEIPT_LATIN_FONT}`),
    document.fonts.load(`400 24px ${RECEIPT_LATIN_FONT}`),
    document.fonts.load(`600 24px ${RECEIPT_LATIN_FONT}`),
    document.fonts.load(`400 12px ${RECEIPT_CJK_FONT}`),
    document.fonts.load(`700 12px ${RECEIPT_CJK_FONT}`),
    document.fonts.load(`400 24px ${RECEIPT_CJK_FONT}`),
    document.fonts.load(`700 24px ${RECEIPT_CJK_FONT}`),
  ];
  await Promise.all(loads.map((p) => p.catch(() => undefined)));
  await document.fonts.ready;
}

export async function renderReceipt(
  commands: ParsedCommand[],
  paperWidthPx: number,
  options: ReceiptRenderOptions = {},
): Promise<RenderResult & { canvas: HTMLCanvasElement }> {
  const fontFamily = options.fontFamily ?? DEFAULT_FONT;
  await ensureReceiptFonts();
  const highlightCommandId = options.highlightCommandId;
  const layoutTuning = normalizeReceiptLayout(options.layout);
  const layout = layoutMetrics(paperWidthPx);
  const elements = buildRenderElements(commands, paperWidthPx, layoutTuning);
  const layoutCellWidth = layout.charWidthPx;
  const canvasWidth = layout.canvasWidth;
  const canvasHeight = Math.max(
    320,
    elements.reduce((max, element) => Math.max(max, element.y + element.height), 0) + VERTICAL_PADDING,
  );

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { elements, canvasWidth, canvasHeight, imageDataUrl: "", canvas };
  }

  ctx.fillStyle = "#f3f1eb";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "#fffef8";
  ctx.fillRect(PAPER_INSET, PAPER_INSET, paperWidthPx, canvasHeight - PAPER_INSET * 2);

  const imageCache = new Map<string, HTMLImageElement>();
  for (const command of commands) {
    if (command.category === "image" || command.category === "rasterImage") {
      const imageCmd = command as ImageCommand;
      if (imageCmd.imageDataUrl && !imageCache.has(imageCmd.imageDataUrl)) {
        imageCache.set(imageCmd.imageDataUrl, await loadImage(imageCmd.imageDataUrl));
      }
    }
  }

  const state: RenderState = {
    alignment: "left",
    charWidthMul: 1,
    charHeightMul: 1,
    bold: false,
    underline: false,
    invert: false,
    pendingQrData: "",
    pendingQrSize: 3,
    pendingQrEc: "M",
    lineSpacingDots: DEFAULT_LINE_SPACING_DOTS,
    cellWidthScale: 1,
  };

  const drawnTextElements = new Set<RenderElement>();

  for (const command of commands) {
    const isHighlighted = highlightCommandId === command.id;

    switch (command.category) {
      case "alignment":
        state.alignment = command.alignment;
        break;
      case "font":
        state.charWidthMul = command.width;
        state.charHeightMul = command.height;
        state.bold = command.bold;
        state.underline = command.underline;
        break;
      case "style":
        if (command.bold !== undefined) state.bold = command.bold;
        if (command.underline !== undefined) state.underline = command.underline;
        if (command.invert !== undefined) state.invert = command.invert;
        break;
      case "text": {
        const lineElements = elements.filter(
          (e) =>
            e.type === "text" &&
            (e.commandId === command.id || e.mergedCommandIds?.includes(command.id)),
        );
        if (lineElements.length === 0) break;
        ctx.textAlign = "left";
        for (const element of lineElements) {
          if (drawnTextElements.has(element)) continue;
          drawnTextElements.add(element);
          const content = element.content ?? " ";
          const layoutCell = element.fontSize ?? layout.charWidthPx;
          const charWidthMul = element.charWidthMul ?? state.charWidthMul;
          const charHeightMul = element.charHeightMul ?? state.charHeightMul;
          const bold = element.bold ?? state.bold;
          const underline = element.underline ?? state.underline;
          const invert = element.invert ?? false;
          if (isHighlighted) {
            ctx.fillStyle = "rgba(255, 214, 102, 0.45)";
            ctx.fillRect(
              (element.x ?? PAPER_INSET) - 4,
              element.y - 2,
              (element.width ?? 0) + 8,
              element.height + 4,
            );
          }
          const fontPx = layoutCell * charHeightMul * layoutTuning.fontSizeScale;
          const visualHeight = fontPx;
          const yOffset = Math.max(0, element.height - visualHeight);
          const measuredWidth = measureReceiptLineWidth(content, layoutCell, charWidthMul);
          const drawX = element.x ?? PAPER_INSET;
          const drawW = element.width ?? measuredWidth;
          if (invert) {
            ctx.fillStyle = "#1a1a1a";
            ctx.fillRect(drawX, element.y + yOffset, drawW, visualHeight);
          }
          ctx.fillStyle = invert ? "#f8f8f8" : "#1a1a1a";
          drawReceiptLine(
            ctx,
            content,
            drawX,
            element.y + yOffset,
            layoutCell,
            charWidthMul,
            charHeightMul,
            layoutTuning.fontSizeScale,
            bold,
            fontFamily,
          );
          if (underline) {
            ctx.fillRect(
              drawX,
              element.y + yOffset + visualHeight + 2,
              element.width ?? measuredWidth,
              1,
            );
          }
        }
        break;
      }
      case "lineFeed":
      case "feed": {
        const element = elements.find((e) => e.commandId === command.id);
        if (isHighlighted && element) {
          ctx.fillStyle = "rgba(255, 214, 102, 0.35)";
          ctx.fillRect(PAPER_INSET, element.y, paperWidthPx, element.height);
        }
        break;
      }
      case "lineSpacing": {
        state.lineSpacingDots =
          command.spacing === null ? DEFAULT_LINE_SPACING_DOTS : command.spacing;
        if (isHighlighted) {
          const idx = commands.indexOf(command);
          for (let j = idx + 1; j < commands.length; j++) {
            const nextCmd = commands[j]!;
            if (nextCmd.category === "feed" || nextCmd.category === "lineFeed") {
              const element = elements.find((e) => e.commandId === nextCmd.id);
              if (element) {
                ctx.fillStyle = "rgba(255, 214, 102, 0.35)";
                ctx.fillRect(PAPER_INSET, element.y, paperWidthPx, element.height);
              }
              break;
            }
            if (
              nextCmd.category === "text" ||
              nextCmd.category === "image" ||
              nextCmd.category === "rasterImage" ||
              nextCmd.category === "barcode" ||
              nextCmd.category === "qrCode"
            ) {
              break;
            }
          }
        }
        break;
      }
      case "image":
      case "rasterImage": {
        const imageCmd = command as ImageCommand;
        const element = elements.find((e) => e.commandId === command.id);
        if (!element) break;
        const img = imageCache.get(imageCmd.imageDataUrl);
        const x = element.x ?? PAPER_INSET;
        const w = element.width ?? imageCmd.width;
        const h = element.height - 8;
        if (isHighlighted) {
          ctx.strokeStyle = "#f5a623";
          ctx.lineWidth = 3;
          ctx.strokeRect(x - 3, element.y - 3, w + 6, h + 6);
        }
        if (img) ctx.drawImage(img, x, element.y, w, h);
        break;
      }
      case "barcode": {
        const barcodeCmd = command as BarcodeCommand;
        const element = elements.find((e) => e.commandId === command.id);
        if (!element) break;
        if (isHighlighted) {
          ctx.fillStyle = "rgba(255, 214, 102, 0.35)";
          ctx.fillRect(
            (element.x ?? PAPER_INSET) - 4,
            element.y - 4,
            (element.width ?? 220) + 8,
            element.height + 8,
          );
        }
        drawEscPosBarcode(
          ctx,
          element.x ?? PAPER_INSET,
          element.y,
          barcodeCmd.symbology,
          barcodeCmd.data,
          barcodeCmd.height,
          barcodeCmd.width,
          barcodeCmd.position,
          paperWidthPx,
        );
        break;
      }
      case "qrCode": {
        const qrCmd = command as QrCodeCommand;
        applyQrPendingState(state, qrCmd);
        if (qrCmd.label === "Print QR Code") {
          const element = elements.find((e) => e.commandId === command.id);
          if (!element) break;
          const modulePx = qrModulePx(
            state.pendingQrSize,
            state.pendingQrData,
            paperWidthPx,
            state.pendingQrEc,
          );
          const qrDrawSize =
            (element.width ?? 0) > 0 ? (element.width ?? 0) : modulePx * 21;
          if (isHighlighted) {
            ctx.strokeStyle = "#f5a623";
            ctx.lineWidth = 3;
            ctx.strokeRect(
              (element.x ?? PAPER_INSET) - 3,
              element.y - 3,
              (element.width ?? qrDrawSize) + 6,
              (element.height ?? qrDrawSize) + 6,
            );
          }
          drawQrMatrix(
            ctx,
            element.x ?? PAPER_INSET,
            element.y,
            state.pendingQrData,
            modulePx,
            state.pendingQrEc,
          );
        }
        break;
      }
      case "cashDrawer": {
        const element = elements.find((e) => e.commandId === command.id);
        if (!element) break;
        const x = element.x ?? PAPER_INSET;
        const w = element.width ?? paperWidthPx;
        const h = element.height;
        ctx.fillStyle = isHighlighted ? "rgba(255, 214, 102, 0.35)" : "#eceae4";
        ctx.fillRect(x, element.y, w, h);
        ctx.strokeStyle = isHighlighted ? "#f5a623" : "#888";
        ctx.lineWidth = isHighlighted ? 2 : 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(x + 6, element.y + 6, w - 12, h - 12);
        ctx.setLineDash([]);
        ctx.fillStyle = "#444";
        ctx.font = '11px "IBM Plex Sans", sans-serif';
        ctx.textAlign = "center";
        ctx.fillText("Cash Drawer", x + w / 2, element.y + h / 2 + 4);
        ctx.textAlign = "left";
        break;
      }
      case "cut": {
        const element = elements.find((e) => e.commandId === command.id);
        if (!element) break;
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = isHighlighted ? "#f5a623" : "#bbb";
        ctx.lineWidth = isHighlighted ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(PAPER_INSET, element.y + 12);
        ctx.lineTo(PAPER_INSET + paperWidthPx, element.y + 12);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#888";
        ctx.font = '10px "IBM Plex Sans", sans-serif';
        ctx.fillText("cut", PAPER_INSET + paperWidthPx - 24, element.y);
        break;
      }
      default:
        break;
    }
  }

  return {
    elements,
    canvasWidth,
    canvasHeight,
    imageDataUrl: canvas.toDataURL("image/png"),
    canvas,
  };
}

export async function renderReceiptToCanvas(
  commands: ParsedCommand[],
  canvasWidth: number,
  options: ReceiptRenderOptions = {},
): Promise<HTMLCanvasElement> {
  const result = await renderReceipt(commands, canvasWidth, options);
  return result.canvas;
}
