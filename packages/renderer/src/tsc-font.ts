/** TSC built-in font cell size in dots (width × height). */
const TSC_BUILTIN: Record<string, { cellW: number; cellH: number }> = {
  "0": { cellW: 8, cellH: 12 },
  "1": { cellW: 8, cellH: 12 },
  "2": { cellW: 12, cellH: 20 },
  "3": { cellW: 16, cellH: 24 },
  "4": { cellW: 24, cellH: 32 },
  "5": { cellW: 32, cellH: 48 },
  "6": { cellW: 14, cellH: 19 },
  "7": { cellW: 21, cellH: 27 },
  "8": { cellW: 14, cellH: 25 },
};

export interface TscFontMetrics {
  cellW: number;
  cellH: number;
}

/** Resolve TSC / TSS font to dot cell metrics. */
export function getTscFontMetrics(font: string): TscFontMetrics {
  if (TSC_BUILTIN[font] !== undefined) return TSC_BUILTIN[font]!;

  const tss = font.match(/TSS(\d+)/i);
  if (tss) {
    const h = Number.parseInt(tss[1]!, 10);
    return { cellW: Math.round(h / 2), cellH: h };
  }

  const num = font.match(/(\d+)/);
  const h = num ? Number.parseInt(num[1]!, 10) : 20;
  return { cellW: Math.round(h / 2), cellH: h };
}

function isFullWidthChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code > 0x7f;
}

/** Character advance in dots (ASCII half-width vs CJK full-width). */
export function tscCharAdvance(ch: string, cellW: number, xMul: number): number {
  return (isFullWidthChar(ch) ? cellW * 2 : cellW) * xMul;
}

/**
 * Draw TSPL TEXT using fixed dot cells — matches TSC printer spacing for spaces and xMul/yMul.
 */
export function drawTscText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  font: string,
  rotation: number,
  xMul: number,
  yMul: number,
  content: string,
): void {
  const { cellW, cellH } = getTscFontMetrics(font);

  ctx.save();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.font = `${cellH}px "Courier New", Courier, monospace`;

  const baseCharW = ctx.measureText("0").width || cellW;
  const scaleX = (cellW * xMul) / baseCharW;
  const scaleY = yMul;

  if (rotation) {
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);
    drawTscTextCells(ctx, 0, 0, content, cellW, xMul, scaleX, scaleY);
  } else {
    drawTscTextCells(ctx, x, y, content, cellW, xMul, scaleX, scaleY);
  }

  ctx.restore();
}

function drawTscTextCells(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  content: string,
  cellW: number,
  xMul: number,
  scaleX: number,
  scaleY: number,
): void {
  let cursor = x;
  for (const ch of content) {
    const advance = tscCharAdvance(ch, cellW, xMul);
    if (ch !== " ") {
      ctx.save();
      ctx.translate(cursor, y);
      ctx.scale(scaleX, scaleY);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    }
    cursor += advance;
  }
}

export function tscTextWidthDots(content: string, font: string, xMul: number): number {
  const { cellW } = getTscFontMetrics(font);
  let w = 0;
  for (const ch of content) w += tscCharAdvance(ch, cellW, xMul);
  return w;
}

export function tscTextHeightDots(font: string, yMul: number): number {
  return getTscFontMetrics(font).cellH * yMul;
}
