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

const BASE_FONT_SIZE = 14;
const LINE_HEIGHT = 18;
const PADDING = 16;
const CHAR_WIDTH = 8;

interface RenderState {
  alignment: "left" | "center" | "right";
  fontScale: number;
  bold: boolean;
  underline: boolean;
  pendingQrData: string;
  pendingQrSize: number;
}

function textWidth(text: string, fontScale: number, bold: boolean): number {
  const scale = fontScale * (bold ? 1.05 : 1);
  return text.length * CHAR_WIDTH * scale;
}

function alignX(
  contentWidth: number,
  canvasWidth: number,
  alignment: "left" | "center" | "right",
): number {
  if (alignment === "center") return Math.max(PADDING, (canvasWidth - contentWidth) / 2);
  if (alignment === "right") return Math.max(PADDING, canvasWidth - PADDING - contentWidth);
  return PADDING;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawBarcodePlaceholder(
  ctx: CanvasRenderingContext2D,
  command: BarcodeCommand,
  x: number,
  y: number,
  maxWidth: number,
): number {
  const height = 48;
  const barWidth = Math.min(maxWidth - PADDING * 2, 220);

  ctx.fillStyle = "#111";
  ctx.fillRect(x, y, barWidth, height);

  let stripeX = x + 4;
  while (stripeX < x + barWidth - 4) {
    const stripeW = 2 + (stripeX % 5);
    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(stripeX, y + 4, stripeW, height - 8);
    stripeX += stripeW + 2;
  }

  ctx.fillStyle = "#222";
  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.textAlign = "center";
  ctx.fillText(command.data, x + barWidth / 2, y + height + 14);
  ctx.textAlign = "left";

  return height + 22;
}

function drawQrPlaceholder(
  ctx: CanvasRenderingContext2D,
  data: string,
  size: number,
  x: number,
  y: number,
): number {
  const modules = 21 + (size - 1) * 4;
  const moduleSize = Math.max(3, Math.floor(120 / modules));
  const qrSize = modules * moduleSize;

  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, qrSize, qrSize);
  ctx.fillStyle = "#111";

  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      const inFinder =
        (row < 7 && col < 7) ||
        (row < 7 && col >= modules - 7) ||
        (row >= modules - 7 && col < 7);
      const hash = (row * 17 + col * 31 + data.length) % 5;
      if (inFinder || hash > 1) {
        ctx.fillRect(x + col * moduleSize, y + row * moduleSize, moduleSize, moduleSize);
      }
    }
  }

  return qrSize + 8;
}

export function buildRenderElements(commands: ParsedCommand[], canvasWidth: number): RenderElement[] {
  const elements: RenderElement[] = [];
  const state: RenderState = {
    alignment: "left",
    fontScale: 1,
    bold: false,
    underline: false,
    pendingQrData: "",
    pendingQrSize: 3,
  };

  let y = PADDING;

  for (const command of commands) {
    switch (command.category) {
      case "alignment":
        state.alignment = command.alignment;
        break;
      case "font":
        state.fontScale = Math.max(command.width, command.height);
        state.bold = command.bold;
        state.underline = command.underline;
        break;
      case "style":
        if (command.bold !== undefined) state.bold = command.bold;
        if (command.underline !== undefined) state.underline = command.underline;
        break;
      case "text": {
        const textCmd = command as TextCommand;
        for (const line of textCmd.text.split("\n")) {
          const content = line || " ";
          const width = textWidth(content, state.fontScale, state.bold);
          const x = alignX(width, canvasWidth, state.alignment);
          const height = LINE_HEIGHT * state.fontScale;
          elements.push({
            commandId: command.id,
            type: "text",
            y,
            height,
            x,
            width,
            content,
            alignment: state.alignment,
            fontSize: BASE_FONT_SIZE * state.fontScale,
            bold: state.bold,
            underline: state.underline,
          });
          y += height;
        }
        break;
      }
      case "lineFeed":
      case "feed":
        elements.push({ commandId: command.id, type: "feed", y, height: LINE_HEIGHT });
        y += LINE_HEIGHT;
        break;
      case "image":
      case "rasterImage": {
        const imageCmd = command as ImageCommand;
        const displayWidth = Math.min(imageCmd.width, canvasWidth - PADDING * 2);
        const displayHeight =
          imageCmd.width > 0 ? Math.round((imageCmd.height / imageCmd.width) * displayWidth) : 0;
        const x = alignX(displayWidth, canvasWidth, state.alignment);
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
        const width = Math.min(240, canvasWidth - PADDING * 2);
        const x = alignX(width, canvasWidth, state.alignment);
        elements.push({
          commandId: command.id,
          type: "barcode",
          y,
          height: 70,
          x,
          width,
          content: barcodeCmd.data,
          alignment: state.alignment,
        });
        y += 70;
        break;
      }
      case "qrCode": {
        const qrCmd = command as QrCodeCommand;
        if (qrCmd.data) state.pendingQrData = qrCmd.data;
        if (qrCmd.size) state.pendingQrSize = qrCmd.size;
        if (qrCmd.label === "Print QR Code" || (qrCmd.data && qrCmd.label === "QR Code")) {
          const qrSize = 120;
          const x = alignX(qrSize, canvasWidth, state.alignment);
          elements.push({
            commandId: command.id,
            type: "qr",
            y,
            height: qrSize + 8,
            x,
            width: qrSize,
            content: state.pendingQrData,
            alignment: state.alignment,
          });
          y += qrSize + 8;
        }
        break;
      }
      case "cut":
        elements.push({ commandId: command.id, type: "cut", y, height: 24 });
        y += 24;
        break;
      default:
        break;
    }
  }

  return elements;
}

export async function renderReceipt(
  commands: ParsedCommand[],
  canvasWidth: number,
  highlightCommandId?: string | null,
): Promise<RenderResult & { canvas: HTMLCanvasElement }> {
  const elements = buildRenderElements(commands, canvasWidth);
  const canvasHeight = Math.max(
    320,
    elements.reduce((max, element) => Math.max(max, element.y + element.height), 0) + PADDING,
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
  ctx.fillRect(8, 8, canvasWidth - 16, canvasHeight - 16);

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
    fontScale: 1,
    bold: false,
    underline: false,
    pendingQrData: "",
    pendingQrSize: 3,
  };

  for (const command of commands) {
    const isHighlighted = highlightCommandId === command.id;

    switch (command.category) {
      case "alignment":
        state.alignment = command.alignment;
        break;
      case "font":
        state.fontScale = Math.max(command.width, command.height);
        state.bold = command.bold;
        state.underline = command.underline;
        break;
      case "style":
        if (command.bold !== undefined) state.bold = command.bold;
        if (command.underline !== undefined) state.underline = command.underline;
        break;
      case "text": {
        const textCmd = command as TextCommand;
        const lineElements = elements.filter((e) => e.commandId === command.id && e.type === "text");
        if (lineElements.length === 0) break;
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        textCmd.text.split("\n").forEach((line, i) => {
          const element = lineElements[i];
          if (!element) return;
          const content = line || " ";
          const fontSize = element.fontSize ?? BASE_FONT_SIZE * state.fontScale;
          const bold = element.bold ?? state.bold;
          const underline = element.underline ?? state.underline;
          ctx.font = `${bold ? "600" : "400"} ${fontSize}px "IBM Plex Mono", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", monospace`;
          if (isHighlighted) {
            ctx.fillStyle = "rgba(255, 214, 102, 0.45)";
            ctx.fillRect(
              (element.x ?? PADDING) - 4,
              element.y - 2,
              (element.width ?? 0) + 8,
              element.height + 4,
            );
          }
          ctx.fillStyle = "#1a1a1a";
          ctx.fillText(content, element.x ?? PADDING, element.y);
          if (underline) {
            ctx.fillRect(
              element.x ?? PADDING,
              element.y + fontSize + 2,
              textWidth(content, fontSize / BASE_FONT_SIZE, bold),
              1,
            );
          }
        });
        break;
      }
      case "lineFeed":
      case "feed": {
        const element = elements.find((e) => e.commandId === command.id);
        if (isHighlighted && element) {
          ctx.fillStyle = "rgba(255, 214, 102, 0.35)";
          ctx.fillRect(PADDING, element.y, canvasWidth - PADDING * 2, element.height);
        }
        break;
      }
      case "image":
      case "rasterImage": {
        const imageCmd = command as ImageCommand;
        const element = elements.find((e) => e.commandId === command.id);
        if (!element) break;
        const img = imageCache.get(imageCmd.imageDataUrl);
        const x = element.x ?? PADDING;
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
            (element.x ?? PADDING) - 4,
            element.y - 4,
            (element.width ?? 220) + 8,
            element.height + 8,
          );
        }
        drawBarcodePlaceholder(ctx, barcodeCmd, element.x ?? PADDING, element.y, canvasWidth);
        break;
      }
      case "qrCode": {
        const qrCmd = command as QrCodeCommand;
        if (qrCmd.data) state.pendingQrData = qrCmd.data;
        if (qrCmd.size) state.pendingQrSize = qrCmd.size;
        if (qrCmd.label === "Print QR Code") {
          const element = elements.find((e) => e.commandId === command.id);
          if (!element) break;
          if (isHighlighted) {
            ctx.strokeStyle = "#f5a623";
            ctx.lineWidth = 3;
            ctx.strokeRect((element.x ?? PADDING) - 3, element.y - 3, 126, 126);
          }
          drawQrPlaceholder(
            ctx,
            state.pendingQrData,
            state.pendingQrSize,
            element.x ?? PADDING,
            element.y,
          );
        }
        break;
      }
      case "cut": {
        const element = elements.find((e) => e.commandId === command.id);
        if (!element) break;
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = isHighlighted ? "#f5a623" : "#bbb";
        ctx.lineWidth = isHighlighted ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(PADDING, element.y + 12);
        ctx.lineTo(canvasWidth - PADDING, element.y + 12);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#888";
        ctx.font = '10px "IBM Plex Sans", sans-serif';
        ctx.fillText("cut", canvasWidth - PADDING - 24, element.y);
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
): Promise<HTMLCanvasElement> {
  const result = await renderReceipt(commands, canvasWidth);
  return result.canvas;
}
