import type { EscPosCommand, TextAlign } from "@virt-printer/escpos";
import { drawBarcodePreview, drawQrPreview } from "./barcode.js";
import { drawBitImageColumn, drawRasterBitmap } from "./raster.js";
import type { RenderOptions } from "./types.js";

const DEFAULT_RECEIPT_WIDTH = 384;

interface LayoutLine {
  kind: EscPosCommand["kind"];
  y: number;
  height: number;
  cmd: EscPosCommand;
}

function fontSize(cmd: Extract<EscPosCommand, { kind: "text" }>): number {
  let size = cmd.font === "b" ? 12 : 14;
  if (cmd.doubleWidth) size += 4;
  if (cmd.doubleHeight) size += 4;
  return size;
}

function charDisplayWidth(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  return code > 0xff ? 2 : 1;
}

function wrapText(text: string, maxCols: number): string[] {
  if (text.length <= maxCols) return [text];
  const lines: string[] = [];
  let current = "";
  let width = 0;
  for (const ch of text) {
    const cw = charDisplayWidth(ch);
    if (width + cw > maxCols && current.length > 0) {
      lines.push(current);
      current = ch;
      width = cw;
    } else {
      current += ch;
      width += cw;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function layoutCommands(commands: EscPosCommand[], widthPx: number, padding: number): LayoutLine[] {
  const lines: LayoutLine[] = [];
  let y = padding;
  let align: TextAlign = "left";
  const contentWidth = widthPx - padding * 2;

  for (const cmd of commands) {
    if (cmd.kind === "align") {
      align = cmd.value;
      continue;
    }

    if (cmd.kind === "text") {
      const effectiveAlign = cmd.align ?? align;
      const size = fontSize(cmd);
      const charWidth = cmd.doubleWidth ? 12 : 8;
      const maxChars = Math.max(8, Math.floor(contentWidth / charWidth));
      const chunks = wrapText(cmd.text, maxChars);
      for (const chunk of chunks) {
        const h = size + 6;
        lines.push({ kind: "text", y, height: h, cmd: { ...cmd, text: chunk, align: effectiveAlign } });
        y += h;
      }
      continue;
    }

    if (cmd.kind === "line") {
      lines.push({ kind: "line", y, height: 10, cmd });
      y += 10;
      continue;
    }

    if (cmd.kind === "feed") {
      y += 20 * cmd.lines;
      continue;
    }

    if (cmd.kind === "feedUnits") {
      y += Math.max(4, Math.floor(cmd.units * 0.35));
      continue;
    }

    if (cmd.kind === "barcode") {
      const h = cmd.height + (cmd.hri === "none" ? 0 : cmd.hri === "both" ? 32 : 16);
      lines.push({ kind: "barcode", y, height: h, cmd });
      y += h + 8;
      continue;
    }

    if (cmd.kind === "qrcode") {
      const dim = 24 + cmd.size * 8;
      lines.push({ kind: "qrcode", y, height: dim + 8, cmd });
      y += dim + 16;
      continue;
    }

    if (cmd.kind === "raster") {
      const scale = cmd.mode >= 1 ? 2 : 1;
      const h = cmd.height * scale;
      lines.push({ kind: "raster", y, height: h + 4, cmd });
      y += h + 8;
      continue;
    }

    if (cmd.kind === "bitImage") {
      const h = cmd.height + 4;
      lines.push({ kind: "bitImage", y, height: h, cmd });
      y += h + 4;
      continue;
    }

    if (cmd.kind === "cut") {
      lines.push({ kind: "cut", y, height: 16, cmd });
      y += 16;
      continue;
    }

    if (cmd.kind === "cashDrawer") {
      lines.push({ kind: "cashDrawer", y, height: 14, cmd });
      y += 14;
    }
  }

  return lines;
}

export function renderEscPosToCanvas(
  commands: EscPosCommand[],
  options: RenderOptions = {},
): HTMLCanvasElement {
  const widthPx = options.widthPx ?? DEFAULT_RECEIPT_WIDTH;
  const padding = options.paddingPx ?? 16;
  const bg = options.background ?? "#ffffff";
  const fg = options.foreground ?? "#111111";

  const layout = layoutCommands(commands, widthPx, padding);
  const totalHeight = Math.max(
    120,
    layout.length > 0 ? layout[layout.length - 1]!.y + layout[layout.length - 1]!.height + padding : padding * 2,
  );

  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, widthPx, totalHeight);
  ctx.fillStyle = fg;

  for (const line of layout) {
    const cmd = line.cmd;
    const y = line.y;

    if (cmd.kind === "text") {
      const size = fontSize(cmd);
      ctx.font = `${cmd.bold || cmd.doubleStrike ? "bold " : ""}${size}px monospace`;
      ctx.textBaseline = "top";
      ctx.textAlign = cmd.align ?? "left";
      const x =
        cmd.align === "center" ? widthPx / 2 : cmd.align === "right" ? widthPx - padding : padding;
      ctx.fillStyle = fg;
      ctx.fillText(cmd.text, x, y);
      if (cmd.underline) {
        const w = ctx.measureText(cmd.text).width;
        const ux = cmd.align === "center" ? x - w / 2 : cmd.align === "right" ? x - w : x;
        ctx.fillRect(ux, y + size, w, 1);
      }
      continue;
    }

    if (cmd.kind === "line") {
      ctx.fillStyle = "#cccccc";
      ctx.fillRect(padding, y + 4, widthPx - padding * 2, 1);
      ctx.fillStyle = fg;
      continue;
    }

    if (cmd.kind === "barcode") {
      drawBarcodePreview(ctx, padding, y, widthPx - padding * 2, cmd.height, cmd.data, cmd.hri, fg);
      continue;
    }

    if (cmd.kind === "qrcode") {
      drawQrPreview(ctx, padding + 40, y, 24 + cmd.size * 8, cmd.data, fg);
      continue;
    }

    if (cmd.kind === "raster") {
      const scale = cmd.mode >= 1 ? 2 : 1;
      drawRasterBitmap(ctx, padding, y, cmd.widthBytes, cmd.height, cmd.data, scale, fg);
      continue;
    }

    if (cmd.kind === "bitImage") {
      drawBitImageColumn(ctx, padding, y, cmd.width, cmd.height, cmd.data, 1, fg);
      continue;
    }

    if (cmd.kind === "cut") {
      ctx.strokeStyle = "#999999";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding, y + 6);
      ctx.lineTo(widthPx - padding, y + 6);
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }

    if (cmd.kind === "cashDrawer") {
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "#888888";
      ctx.fillText("[钱箱脉冲]", padding, y);
      ctx.fillStyle = fg;
    }
  }

  return canvas;
}
