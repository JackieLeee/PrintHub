import { DEFAULT_PAPER_WIDTH } from "./utils.js";
import { estimatePaperWidthFromRaster } from "../paper-width.js";
import { isBlankBitmap } from "../raster-detect.js";
import type { ImageCommand } from "./types.js";

const BLANK_IMAGE: Pick<ImageCommand, "width" | "height" | "imageSize" | "imageDataUrl" | "mode"> = {
  width: 0,
  height: 0,
  imageSize: 0,
  imageDataUrl: "",
  mode: "blank",
};

export function rasterToDataUrl(data: Uint8Array, width: number, height: number): string {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const imageData = ctx.createImageData(width, height);
  let src = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const byteIndex = Math.floor(x / 8);
      const bitIndex = 7 - (x % 8);
      const on = byteIndex < data.length && ((data[src + byteIndex]! >> bitIndex) & 1) === 1;
      const dst = (y * width + x) * 4;
      const color = on ? 0 : 255;
      imageData.data[dst] = color;
      imageData.data[dst + 1] = color;
      imageData.data[dst + 2] = color;
      imageData.data[dst + 3] = 255;
    }
    src += Math.ceil(width / 8);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export interface EscStarBand {
  mode: number;
  width: number;
  heightDots: number;
  data: Uint8Array;
}

function isBlankBand(band: EscStarBand): boolean {
  return isBlankBitmap(band.data);
}

export function decodeEscStarStripes(
  bands: EscStarBand[],
): Pick<ImageCommand, "width" | "height" | "imageSize" | "imageDataUrl" | "mode"> {
  const activeBands = bands.filter((band) => !isBlankBand(band));
  if (activeBands.length === 0) return { ...BLANK_IMAGE };

  const width = activeBands.reduce((max, band) => Math.max(max, band.width), 0);
  const height = activeBands.reduce((sum, band) => sum + band.heightDots, 0);
  const imageSize = activeBands.reduce((sum, band) => sum + band.data.length, 0);
  const dot24 = activeBands.some((band) => band.mode === 32 || band.mode === 33);
  const density = activeBands.some((band) => band.mode === 1 || band.mode === 33) ? "double" : "single";
  const stripeCount = activeBands.length;
  const mode = `ESC * ${dot24 ? "24" : "8"}-dot ${density} density, ${stripeCount} stripe${stripeCount === 1 ? "" : "s"}`;

  if (typeof document === "undefined") {
    return { width, height, imageSize, imageDataUrl: "", mode };
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { width, height, imageSize, imageDataUrl: "", mode };
  }

  const imageData = ctx.createImageData(canvas.width, canvas.height);
  imageData.data.fill(255);

  let yOffset = 0;
  for (const band of activeBands) {
    const bytesPerColumn = band.heightDots / 8;
    for (let x = 0; x < band.width; x++) {
      for (let dot = 0; dot < band.heightDots; dot++) {
        const byteIndex = x * bytesPerColumn + (dot >> 3);
        const bit = 7 - (dot & 7);
        const on = byteIndex < band.data.length && ((band.data[byteIndex]! >> bit) & 1) === 1;
        if (!on) continue;
        const dst = ((yOffset + dot) * canvas.width + x) * 4;
        imageData.data[dst] = 0;
        imageData.data[dst + 1] = 0;
        imageData.data[dst + 2] = 0;
      }
    }
    yOffset += band.heightDots;
  }

  ctx.putImageData(imageData, 0, 0);
  return {
    width,
    height,
    imageSize,
    imageDataUrl: canvas.toDataURL("image/png"),
    mode,
  };
}

export function decodeGsV0Image(
  mode: number,
  width: number,
  height: number,
  data: Uint8Array,
): Pick<ImageCommand, "width" | "height" | "imageSize" | "imageDataUrl" | "mode"> {
  if (height <= 0 || width <= 0 || isBlankBitmap(data)) {
    return { ...BLANK_IMAGE };
  }

  const modeLabels: Record<number, string> = {
    0: "normal",
    1: "double width",
    2: "double height",
    3: "quadruple",
  };

  return {
    width,
    height,
    imageSize: data.length,
    imageDataUrl: rasterToDataUrl(data, width, height),
    mode: `GS v 0 (${modeLabels[mode] ?? `mode ${mode}`})`,
  };
}

export function estimatePaperWidthFromImage(width: number): number {
  return estimatePaperWidthFromRaster(width) || DEFAULT_PAPER_WIDTH;
}
