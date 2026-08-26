import type { TsplCommand, TsplLabelMeta } from "@virt-printer/tspl";
import { defaultLabelMeta, toDots } from "@virt-printer/tspl";
import { drawBarcodePreview, drawQrPreview } from "./barcode.js";
import type { RenderOptions } from "./types.js";
import { drawRasterBitmap } from "./raster.js";

const PREVIEW_SCALE = 1; // 1 canvas px = 1 dot

function resolveLabelMeta(commands: TsplCommand[]): TsplLabelMeta {
  const meta = defaultLabelMeta();
  for (const cmd of commands) {
    if (cmd.kind === "size") {
      meta.widthDots = toDots(cmd.width, cmd.unit);
      meta.heightDots = toDots(cmd.height, cmd.unit);
      meta.unit = cmd.unit;
    }
    if (cmd.kind === "direction") meta.direction = cmd.value;
    if (cmd.kind === "reference") meta.reference = { x: cmd.x, y: cmd.y };
  }
  return meta;
}

function drawableCommands(commands: TsplCommand[]): TsplCommand[] {
  let start = 0;
  for (let i = 0; i < commands.length; i++) {
    if (commands[i]!.kind === "cls") start = i + 1;
  }
  return commands.slice(start).filter((c) => c.kind !== "print" && c.kind !== "home");
}

function fontSize(xMul: number, yMul: number): number {
  return 12 + Math.max(0, xMul - 1) * 4 + Math.max(0, yMul - 1) * 4;
}

function wrapBlockText(content: string, maxWidthPx: number, ctx: CanvasRenderingContext2D): string[] {
  const words = content.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidthPx && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [content];
}

export function renderTsplToCanvas(
  commands: TsplCommand[],
  options: RenderOptions = {},
): HTMLCanvasElement {
  const padding = options.paddingPx ?? 16;
  const bg = options.background ?? "#ffffff";
  const fg = options.foreground ?? "#111111";

  const meta = resolveLabelMeta(commands);
  const drawList = drawableCommands(commands);

  const labelW = Math.max(meta.widthDots, 80);
  const labelH = Math.max(meta.heightDots, 60);

  const canvas = document.createElement("canvas");
  canvas.width = labelW * PREVIEW_SCALE + padding * 2;
  canvas.height = labelH * PREVIEW_SCALE + padding * 2;

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const ox = padding + meta.reference.x * PREVIEW_SCALE;
  const oy = padding + meta.reference.y * PREVIEW_SCALE;

  ctx.save();
  if (meta.direction === 1) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
  }

  // Label border (cut line hint)
  ctx.strokeStyle = "#dddddd";
  ctx.lineWidth = 1;
  ctx.strokeRect(padding, padding, labelW * PREVIEW_SCALE, labelH * PREVIEW_SCALE);

  ctx.fillStyle = fg;
  ctx.strokeStyle = fg;

  for (const cmd of drawList) {
    if (cmd.kind === "text") {
      const size = fontSize(cmd.xMul, cmd.yMul);
      ctx.font = `${size}px sans-serif`;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.save();
      const tx = ox + cmd.x * PREVIEW_SCALE;
      const ty = oy + cmd.y * PREVIEW_SCALE;
      if (cmd.rotation) {
        ctx.translate(tx, ty);
        ctx.rotate((cmd.rotation * Math.PI) / 180);
        ctx.fillText(cmd.content, 0, 0);
      } else {
        ctx.fillText(cmd.content, tx, ty);
      }
      ctx.restore();
      continue;
    }

    if (cmd.kind === "block") {
      const size = fontSize(cmd.xMul, cmd.yMul);
      ctx.font = `${size}px sans-serif`;
      ctx.textBaseline = "top";
      const bx = ox + cmd.x * PREVIEW_SCALE;
      const by = oy + cmd.y * PREVIEW_SCALE;
      const bw = cmd.width * PREVIEW_SCALE;
      const lines = wrapBlockText(cmd.content, bw, ctx);
      let ly = by;
      for (const ln of lines) {
        ctx.fillText(ln, bx, ly);
        ly += size + 2;
        if (ly > by + cmd.height * PREVIEW_SCALE) break;
      }
      continue;
    }

    if (cmd.kind === "barcode") {
      const bx = ox + cmd.x * PREVIEW_SCALE;
      const by = oy + cmd.y * PREVIEW_SCALE;
      const hri = cmd.readable === 0 ? "none" : cmd.readable === 2 ? "above" : "below";
      drawBarcodePreview(ctx, bx, by, Math.min(labelW, 200), cmd.height, cmd.data, hri, fg);
      continue;
    }

    if (cmd.kind === "qrcode") {
      const qx = ox + cmd.x * PREVIEW_SCALE;
      const qy = oy + cmd.y * PREVIEW_SCALE;
      const dim = cmd.cellWidth * 8 + 16;
      drawQrPreview(ctx, qx, qy, dim, cmd.data, fg);
      continue;
    }

    if (cmd.kind === "bitmap") {
      const bx = ox + cmd.x * PREVIEW_SCALE;
      const by = oy + cmd.y * PREVIEW_SCALE;
      const widthBytes = Math.ceil(cmd.width / 8);
      drawRasterBitmap(ctx, bx, by, widthBytes, cmd.height, cmd.data, PREVIEW_SCALE, fg);
      continue;
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
      continue;
    }

    if (cmd.kind === "bar") {
      ctx.fillRect(
        ox + cmd.x * PREVIEW_SCALE,
        oy + cmd.y * PREVIEW_SCALE,
        cmd.width * PREVIEW_SCALE,
        cmd.height * PREVIEW_SCALE,
      );
      continue;
    }

    if (cmd.kind === "circle") {
      const cx = ox + cmd.x * PREVIEW_SCALE;
      const cy = oy + cmd.y * PREVIEW_SCALE;
      const r = (cmd.diameter / 2) * PREVIEW_SCALE;
      ctx.lineWidth = cmd.thickness;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }

    if (cmd.kind === "ellipse") {
      const cx = ox + cmd.x * PREVIEW_SCALE + (cmd.width * PREVIEW_SCALE) / 2;
      const cy = oy + cmd.y * PREVIEW_SCALE + (cmd.height * PREVIEW_SCALE) / 2;
      ctx.lineWidth = cmd.thickness;
      ctx.beginPath();
      ctx.ellipse(cx, cy, (cmd.width / 2) * PREVIEW_SCALE, (cmd.height / 2) * PREVIEW_SCALE, 0, 0, Math.PI * 2);
      ctx.stroke();
      continue;
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

  ctx.restore();
  return canvas;
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
