import type { TsplCommand, TsplLabelMeta } from "@virt-printer/tspl";
import { resolveTsplLabelMeta, tsplBitmapForPreview } from "@virt-printer/tspl";
import { drawQrMatrix, drawTsplBarcodePreview } from "./barcode.js";
import { code128WidthDots } from "./code128.js";
import type { QrEcLevel } from "./qr-encode.js";
import QRCode from "qrcode";
import { drawTscText, tscTextHeightDots, tscTextWidthDots } from "./tsc-font.js";
import type { RenderOptions } from "./types.js";
import { drawRasterBitmap } from "./raster.js";

const PREVIEW_SCALE = 1; // 1 canvas px = 1 dot

function tsplQrEcLevel(ec: string): QrEcLevel {
  const level = ec.toUpperCase().charAt(0);
  if (level === "L" || level === "M" || level === "Q" || level === "H") return level;
  return "M";
}

const META_KINDS = new Set<TsplCommand["kind"]>([
  "size",
  "gap",
  "bline",
  "direction",
  "reference",
  "offset",
  "shift",
  "speed",
  "density",
  "feed",
  "backfeed",
  "formfeed",
  "cls",
  "print",
  "home",
]);

function drawableCommands(commands: TsplCommand[]): TsplCommand[] {
  let start = 0;
  for (let i = 0; i < commands.length; i++) {
    if (commands[i]!.kind === "cls") start = i + 1;
  }
  return commands.slice(start).filter((c) => !META_KINDS.has(c.kind));
}

function withLabelTransform(
  ctx: CanvasRenderingContext2D,
  meta: TsplLabelMeta,
  padding: number,
  labelW: number,
  labelH: number,
  draw: (ox: number, oy: number) => void,
): void {
  ctx.save();
  ctx.translate(padding, padding);
  // DIRECTION n: print-head feed direction only (0=forward, 1=backward). POS templates
  // keep top-left coordinates; do not rotate the canvas 180° here.
  if (meta.mirror === 1) {
    ctx.translate(labelW, 0);
    ctx.scale(-1, 1);
  }
  draw(meta.reference.x + meta.shift.x, meta.reference.y + meta.shift.y);
  ctx.restore();
}

function wrapBlockText(content: string, maxWidthPx: number, font: string, xMul: number): string[] {
  const words = content.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    const testWidth = tscTextWidthDots(test, font, xMul);
    if (testWidth > maxWidthPx && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [content];
}

function parseTsplHighlightIndex(highlightCommandId: string | null | undefined): number {
  if (!highlightCommandId?.startsWith("tspl-")) return -1;
  const idx = Number.parseInt(highlightCommandId.slice(5), 10);
  return Number.isFinite(idx) ? idx : -1;
}

function tsplQrPixelSize(data: string, cellWidth: number): number {
  const modulePx = Math.max(2, cellWidth);
  const qr = QRCode.create(data, { errorCorrectionLevel: tsplQrEcLevel("M") });
  return qr.modules.size * modulePx + 8;
}

interface TsplBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

function tsplCommandBounds(cmd: TsplCommand, ox: number, oy: number): TsplBounds | null {
  switch (cmd.kind) {
    case "text":
      return {
        x: ox + cmd.x * PREVIEW_SCALE,
        y: oy + cmd.y * PREVIEW_SCALE,
        w: tscTextWidthDots(cmd.content, cmd.font, cmd.xMul) * PREVIEW_SCALE,
        h: tscTextHeightDots(cmd.font, cmd.yMul) * PREVIEW_SCALE,
      };
    case "block":
      return {
        x: ox + cmd.x * PREVIEW_SCALE,
        y: oy + cmd.y * PREVIEW_SCALE,
        w: cmd.width * PREVIEW_SCALE,
        h: cmd.height * PREVIEW_SCALE,
      };
    case "barcode": {
      const x = ox + cmd.x * PREVIEW_SCALE;
      const y = oy + cmd.y * PREVIEW_SCALE;
      const fmt = cmd.format.replace(/"/g, "").toLowerCase();
      const w =
        fmt === "128" || fmt === "code128"
          ? code128WidthDots(cmd.data, cmd.narrow)
          : Math.max(cmd.data.length * cmd.narrow * 11, cmd.narrow * 40);
      const h = cmd.height + (cmd.readable === 0 ? 0 : 14);
      return { x, y, w, h };
    }
    case "qrcode": {
      const size = tsplQrPixelSize(cmd.data, Math.max(1, cmd.cellWidth));
      return {
        x: ox + cmd.x * PREVIEW_SCALE,
        y: oy + cmd.y * PREVIEW_SCALE,
        w: size,
        h: size,
      };
    }
    case "bitmap":
      return {
        x: ox + cmd.x * PREVIEW_SCALE,
        y: oy + cmd.y * PREVIEW_SCALE,
        w: cmd.width * 8 * PREVIEW_SCALE,
        h: cmd.height * PREVIEW_SCALE,
      };
    case "box":
      return {
        x: ox + cmd.x * PREVIEW_SCALE,
        y: oy + cmd.y * PREVIEW_SCALE,
        w: (cmd.xEnd - cmd.x) * PREVIEW_SCALE,
        h: (cmd.yEnd - cmd.y) * PREVIEW_SCALE,
      };
    case "bar":
      return {
        x: ox + cmd.x * PREVIEW_SCALE,
        y: oy + cmd.y * PREVIEW_SCALE,
        w: cmd.width * PREVIEW_SCALE,
        h: cmd.height * PREVIEW_SCALE,
      };
    case "circle": {
      const d = cmd.diameter * PREVIEW_SCALE;
      return {
        x: ox + (cmd.x - cmd.diameter / 2) * PREVIEW_SCALE,
        y: oy + (cmd.y - cmd.diameter / 2) * PREVIEW_SCALE,
        w: d,
        h: d,
      };
    }
    case "ellipse":
      return {
        x: ox + cmd.x * PREVIEW_SCALE,
        y: oy + cmd.y * PREVIEW_SCALE,
        w: cmd.width * PREVIEW_SCALE,
        h: cmd.height * PREVIEW_SCALE,
      };
    case "reverse":
      return {
        x: ox + cmd.x * PREVIEW_SCALE,
        y: oy + cmd.y * PREVIEW_SCALE,
        w: cmd.width * PREVIEW_SCALE,
        h: cmd.height * PREVIEW_SCALE,
      };
    default:
      return null;
  }
}

function drawTsplHighlight(
  ctx: CanvasRenderingContext2D,
  cmd: TsplCommand,
  ox: number,
  oy: number,
): void {
  const bounds = tsplCommandBounds(cmd, ox, oy);
  if (!bounds) return;

  const pad = 3;
  ctx.save();
  ctx.fillStyle = "rgba(255, 214, 102, 0.45)";
  ctx.strokeStyle = "#f5a623";
  ctx.lineWidth = 2;
  ctx.fillRect(bounds.x - pad, bounds.y - pad, bounds.w + pad * 2, bounds.h + pad * 2);
  ctx.strokeRect(bounds.x - pad, bounds.y - pad, bounds.w + pad * 2, bounds.h + pad * 2);
  ctx.restore();
}

export function renderTsplToCanvas(
  commands: TsplCommand[],
  options: RenderOptions = {},
): HTMLCanvasElement {
  const padding = options.paddingPx ?? 16;
  const bg = options.background ?? "#ffffff";
  const fg = options.foreground ?? "#111111";
  const highlightIdx = parseTsplHighlightIndex(options.highlightCommandId);
  const highlightCmd = highlightIdx >= 0 ? commands[highlightIdx] : null;

  const meta = resolveTsplLabelMeta(commands);
  const drawList = drawableCommands(commands);

  const labelW = Math.max(meta.widthDots, 80);
  const labelH = Math.max(meta.heightDots, 60);

  const canvas = document.createElement("canvas");
  canvas.width = labelW * PREVIEW_SCALE + padding * 2;
  canvas.height = labelH * PREVIEW_SCALE + padding * 2;

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  withLabelTransform(ctx, meta, padding, labelW, labelH, (ox, oy) => {
    ctx.strokeStyle = "#dddddd";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, labelW * PREVIEW_SCALE, labelH * PREVIEW_SCALE);

    ctx.fillStyle = fg;
    ctx.strokeStyle = fg;

    for (const cmd of drawList) {
      if (highlightCmd === cmd) {
        drawTsplHighlight(ctx, cmd, ox, oy);
      }
      drawTsplCommand(ctx, cmd, ox, oy, fg);
    }
  });

  return canvas;
}

function drawTsplCommand(
  ctx: CanvasRenderingContext2D,
  cmd: TsplCommand,
  ox: number,
  oy: number,
  fg: string,
): void {
  if (cmd.kind === "text") {
    drawTscText(
      ctx,
      ox + cmd.x * PREVIEW_SCALE,
      oy + cmd.y * PREVIEW_SCALE,
      cmd.font,
      cmd.rotation,
      cmd.xMul,
      cmd.yMul,
      cmd.content,
    );
    return;
  }

  if (cmd.kind === "block") {
    const lineH = tscTextHeightDots(cmd.font, cmd.yMul);
    const bx = ox + cmd.x * PREVIEW_SCALE;
    const by = oy + cmd.y * PREVIEW_SCALE;
    const bw = cmd.width * PREVIEW_SCALE;
    const lines = wrapBlockText(cmd.content, bw, cmd.font, cmd.xMul);
    let ly = by;
    for (const ln of lines) {
      drawTscText(ctx, bx, ly, cmd.font, cmd.rotation, cmd.xMul, cmd.yMul, ln);
      ly += lineH + 2;
      if (ly > by + cmd.height * PREVIEW_SCALE) break;
    }
    return;
  }

  if (cmd.kind === "barcode") {
    const bx = ox + cmd.x * PREVIEW_SCALE;
    const by = oy + cmd.y * PREVIEW_SCALE;
    const hri = cmd.readable === 0 ? "none" : cmd.readable === 2 ? "above" : "below";
    drawTsplBarcodePreview(
      ctx,
      bx,
      by,
      cmd.format,
      cmd.height,
      cmd.data,
      hri,
      cmd.narrow,
      cmd.wide,
      fg,
    );
    return;
  }

  if (cmd.kind === "qrcode") {
    const qx = ox + cmd.x * PREVIEW_SCALE;
    const qy = oy + cmd.y * PREVIEW_SCALE;
    drawQrMatrix(
      ctx,
      qx,
      qy,
      cmd.data,
      Math.max(1, cmd.cellWidth),
      tsplQrEcLevel(cmd.ecLevel),
      fg,
    );
    return;
  }

  if (cmd.kind === "bitmap") {
    const bx = ox + cmd.x * PREVIEW_SCALE;
    const by = oy + cmd.y * PREVIEW_SCALE;
    const bits = tsplBitmapForPreview(cmd.data);
    drawRasterBitmap(ctx, bx, by, cmd.width, cmd.height, bits, PREVIEW_SCALE, fg);
    return;
  }

  if (cmd.kind === "box") {
    const x = ox + cmd.x * PREVIEW_SCALE;
    const y = oy + cmd.y * PREVIEW_SCALE;
    const w = (cmd.xEnd - cmd.x) * PREVIEW_SCALE;
    const h = (cmd.yEnd - cmd.y) * PREVIEW_SCALE;
    ctx.lineWidth = cmd.thickness;
    if (cmd.radius > 0) {
      roundRect(ctx, x, y, w, h, cmd.radius);
      ctx.stroke();
    } else {
      ctx.strokeRect(x, y, w, h);
    }
    return;
  }

  if (cmd.kind === "bar") {
    ctx.fillRect(
      ox + cmd.x * PREVIEW_SCALE,
      oy + cmd.y * PREVIEW_SCALE,
      cmd.width * PREVIEW_SCALE,
      cmd.height * PREVIEW_SCALE,
    );
    return;
  }

  if (cmd.kind === "circle") {
    const cx = ox + cmd.x * PREVIEW_SCALE;
    const cy = oy + cmd.y * PREVIEW_SCALE;
    const r = (cmd.diameter / 2) * PREVIEW_SCALE;
    ctx.lineWidth = cmd.thickness;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (cmd.kind === "ellipse") {
    const cx = ox + cmd.x * PREVIEW_SCALE + (cmd.width * PREVIEW_SCALE) / 2;
    const cy = oy + cmd.y * PREVIEW_SCALE + (cmd.height * PREVIEW_SCALE) / 2;
    ctx.lineWidth = cmd.thickness;
    ctx.beginPath();
    ctx.ellipse(cx, cy, (cmd.width / 2) * PREVIEW_SCALE, (cmd.height / 2) * PREVIEW_SCALE, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (cmd.kind === "reverse") {
    ctx.fillStyle = "#000000";
    ctx.fillRect(
      ox + cmd.x * PREVIEW_SCALE,
      oy + cmd.y * PREVIEW_SCALE,
      cmd.width * PREVIEW_SCALE,
      cmd.height * PREVIEW_SCALE,
    );
    ctx.fillStyle = fg;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
