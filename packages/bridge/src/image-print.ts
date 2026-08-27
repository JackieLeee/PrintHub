import sharp from "sharp";

export interface ImagePrintOptions {
  protocol: "escpos" | "tspl";
  maxWidth?: number;
}

const DEFAULT_ESC_POS_WIDTH = 384;

function packBitmap1bpp(width: number, height: number, grey: Uint8Array): Buffer {
  const widthBytes = Math.ceil(width / 8);
  const out = Buffer.alloc(widthBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const lum = grey[y * width + x] ?? 255;
      if (lum < 128) {
        out[y * widthBytes + (x >> 3)]! |= 0x80 >> (x & 7);
      }
    }
  }
  return out;
}

function escPosRaster(widthBytes: number, height: number, bitmap: Buffer): Buffer {
  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;
  return Buffer.concat([
    Buffer.from([0x1b, 0x40]),
    Buffer.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]),
    bitmap,
    Buffer.from([0x1b, 0x64, 0x04]),
    Buffer.from([0x1d, 0x56, 0x00]),
  ]);
}

function tsplLabel(widthDots: number, heightDots: number, bitmap: Buffer): Buffer {
  const widthBytes = Math.ceil(widthDots / 8);
  const hex = bitmap.toString("hex");
  const widthMm = Math.ceil(widthDots / 8);
  const heightMm = Math.ceil(heightDots / 8);
  const body =
    `SIZE ${widthMm} mm,${heightMm} mm\r\n` +
    `GAP 2 mm,0\r\n` +
    `CLS\r\n` +
    `BITMAP 10,10,${widthBytes},${heightDots},0,${hex}\r\n` +
    `PRINT 1\r\n`;
  return Buffer.from(body, "utf8");
}

export async function imageBufferToPrintPayload(
  input: Buffer,
  options: ImagePrintOptions,
): Promise<Buffer> {
  const maxWidth = options.maxWidth ?? DEFAULT_ESC_POS_WIDTH;
  const { data, info } = await sharp(input)
    .greyscale()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const bitmap = packBitmap1bpp(width, height, data);
  const widthBytes = Math.ceil(width / 8);

  if (options.protocol === "tspl") {
    return tsplLabel(width, height, bitmap);
  }
  return escPosRaster(widthBytes, height, bitmap);
}
