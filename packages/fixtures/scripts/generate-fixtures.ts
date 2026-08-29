/**
 * Generate realistic ESC/POS + TSPL fixture binaries for regression coverage.
 * Run: pnpm --filter @virt-printer/fixtures exec tsx scripts/generate-fixtures.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const escposDir = join(root, "escpos");
const tsplDir = join(root, "tspl");

function bytes(...vals: number[]): Uint8Array {
  return new Uint8Array(vals);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function qrSequence(data: string): Uint8Array {
  const payload = text(data);
  return concat(
    bytes(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00),
    bytes(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x04),
    bytes(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31),
    bytes(0x1d, 0x28, 0x6b, payload.length + 3, 0x00, 0x31, 0x50, 0x30, ...payload),
    bytes(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30),
  );
}

function gsV0Raster(widthBytes: number, height: number, fill = 0xff): Uint8Array {
  const raster = new Uint8Array(widthBytes * height).fill(fill);
  return concat(
    bytes(0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, height & 0xff, (height >> 8) & 0xff),
    raster,
  );
}

function escStarStripe(width: number, mode = 0): Uint8Array {
  const stripe = new Uint8Array(width).fill(0xaa);
  return concat(bytes(0x1b, 0x2a, mode, width & 0xff, (width >> 8) & 0xff, ...stripe, 0x0a));
}

mkdirSync(escposDir, { recursive: true });
mkdirSync(tsplDir, { recursive: true });

// Real UTF-8 restaurant receipt (from escpos parser regression sample).
const restaurantB64 =
  "G0UBICAgICAgICAgIFByaW50IFN0b3JlICAgICAgICAgICAKG0UAICAgICAgICAgICAgIOe7k+i0puWNlSAgICAgICAgICAgICAKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0K5Y2V5Y+3OiBPMjAyNjA4MjYtMDAwMDAzICDotKbljZU6ICAgCksyMDI2MDgyNi0wMDAwMDMgICAgICAgICAgICAgICAgChtFAeiPnOWTgSAgICAgICAgICAgICAg5pWw6YePICAgICDph5Hpop0KG0UATm9vZGxlICAgICAgICAgICAgICAgMSAgICAgMTIwMAobRQEgICAgICAgICAgICAgICAgIOWQiOiuoTogMTIuMDAgQ05ZChtFAC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tChtFAeaWueW8jyAgICAgICAgICAgICAgICAgICAgICAgIOmHkeminQobRQBjYXNoICAgICAgICAgICAgICAgICAgICAgICAgMTIwMAoKCh1WAA==";
writeFileSync(join(escposDir, "restaurant-utf8.bin"), Buffer.from(restaurantB64, "base64"));

// Retail receipt: status poll prefix + GBK mode + items + EAN13 + QR + partial cut.
writeFileSync(
  join(escposDir, "retail-gbk-receipt.bin"),
  concat(
    bytes(0x10, 0x04, 0x01),
    bytes(0x1b, 0x40),
    bytes(0x1b, 0x61, 0x01),
    bytes(0x1c, 0x26),
    text("社区便利店\n"),
    bytes(0x1b, 0x61, 0x00),
    text("2026-08-29 14:30:05\n"),
    text("--------------------------------\n"),
    text("鲜牛奶 250ml      x2    12.80\n"),
    text("全麦面包          x1     8.50\n"),
    text("--------------------------------\n"),
    bytes(0x1b, 0x45, 0x01),
    text("合计: 21.30\n"),
    bytes(0x1b, 0x45, 0x00),
    text("EAN13:\n"),
    bytes(0x1d, 0x68, 0x50, 0x1d, 0x77, 0x02, 0x1d, 0x48, 0x02),
    bytes(0x1d, 0x6b, 0x43, 0x0d, ...text("6901234567890")),
    text("\n"),
    qrSequence("https://pay.example.com/r/20260829001"),
    bytes(0x1b, 0x64, 0x04),
    bytes(0x1d, 0x56, 0x42, 0x00),
  ),
);

// GS v 0 raster logo + text.
writeFileSync(
  join(escposDir, "raster-logo-cut.bin"),
  concat(
    bytes(0x1b, 0x40, 0x1b, 0x61, 0x01),
    text("PrintHub Market\n"),
    bytes(0x1b, 0x61, 0x00),
    gsV0Raster(24, 24, 0xf0),
    text("\nThank you!\n"),
    bytes(0x1b, 0x64, 0x03),
    bytes(0x1d, 0x56, 0x00),
  ),
);

// ESC * column stripes (legacy cashier style).
writeFileSync(
  join(escposDir, "star-image-receipt.bin"),
  concat(
    bytes(0x1b, 0x40, 0x1b, 0x33, 0x18),
    escStarStripe(192, 33),
    escStarStripe(192, 33),
    escStarStripe(192, 33),
    bytes(0x1b, 0x32),
    text("Column bitmap receipt\n"),
    bytes(0x1b, 0x64, 0x02),
    bytes(0x1b, 0x69),
  ),
);

// GS ( N character table + GS ( A print density (Epson extensions).
writeFileSync(
  join(escposDir, "escpos-charset-density.bin"),
  concat(
    bytes(0x1b, 0x40),
    bytes(0x1d, 0x28, 0x4e, 0x02, 0x00, 0x30, 0x01),
    bytes(0x1d, 0x28, 0x41, 0x02, 0x00, 0x00, 0x40),
    text("Density sample\n"),
    bytes(0x1d, 0x28, 0x4e, 0x01, 0x00, 0x31),
    bytes(0x1b, 0x64, 0x02),
  ),
);

// Cash drawer kick after sale.
writeFileSync(
  join(escposDir, "cash-drawer-sale.bin"),
  concat(
    bytes(0x1b, 0x40),
    text("Cash sale  58.00\n"),
    bytes(0x1b, 0x70, 0x00, 0x19, 0xfa),
    text("Drawer opened\n"),
    bytes(0x1b, 0x64, 0x02),
    bytes(0x1b, 0x6d),
  ),
);

// Mixed styles: upside-down off, intl charset, GS @ re-init mid-stream.
writeFileSync(
  join(escposDir, "style-mix-receipt.bin"),
  concat(
    bytes(0x1b, 0x40),
    bytes(0x1b, 0x7b, 0x00),
    bytes(0x1b, 0x52, 0x00),
    bytes(0x1b, 0x21, 0x30),
    text("WIDE LINE\n"),
    bytes(0x1b, 0x21, 0x00),
    bytes(0x1d, 0x21, 0x11),
    text("GS size 2x2\n"),
    bytes(0x1d, 0x40),
    text("After GS @ reset\n"),
    bytes(0x1b, 0x64, 0x01),
    bytes(0x1d, 0x56, 0x01),
  ),
);

writeFileSync(
  join(tsplDir, "block-label.tspl"),
  [
    "SIZE 40 mm,30 mm",
    "GAP 2 mm,0",
    "DIRECTION 0",
    "CLS",
    'BLOCK 10,10,300,120,"0",0,1,1,2,"Multi-line block text for shipping label. Line two wraps inside the box."',
    'TEXT 10,140,"0",0,1,1,"Footer line"',
    "PRINT 1",
  ].join("\r\n") + "\r\n",
  "utf8",
);

writeFileSync(
  join(tsplDir, "bitmap-label.tspl"),
  [
    "SIZE 40 mm,30 mm",
    "GAP 2 mm,0",
    "CLS",
    'TEXT 10,10,"0",0,1,1,"BITMAP sample"',
    "BITMAP 10,40,2,16,0,FFFF0000FFFF0000",
    'BARCODE 10,70,"128",40,1,0,2,4,"PH20260829"',
    "PRINT 1",
  ].join("\r\n") + "\r\n",
  "utf8",
);

writeFileSync(
  join(tsplDir, "shapes-label.tspl"),
  [
    "SIZE 50 mm,40 mm",
    "GAP 2 mm,0",
    "SPEED 4",
    "DENSITY 8",
    "DIRECTION 0",
    "REFERENCE 0,0",
    "CLS",
    "BOX 8,8,380,300,2",
    "CIRCLE 60,60,40,2",
    "ELLIPSE 180,40,120,60,2",
    'TEXT 20,200,"0",0,1,1,"Shapes fixture"',
    "PRINT 1",
  ].join("\r\n") + "\r\n",
  "utf8",
);

writeFileSync(
  join(tsplDir, "warehouse-label.tspl"),
  [
    "SIZE 60 mm,40 mm",
    "GAP 3 mm,0",
    "BLINE 3 mm,0",
    "OFFSET 0 mm",
    "SHIFT 0",
    "SPEED 3",
    "DENSITY 10",
    "CLS",
    'TEXT 10,12,"0",0,2,2,"WH-A01-042"',
    'BARCODE 10,60,"128",60,1,0,2,4,"WH-A01-042"',
    'QRCODE 260,60,M,4,A,0,"WH-A01-042|20260829"',
    'PUTBMP 1,"logo.bmp"',
    "CODEPAGE 936",
    "PRINT 1,1",
  ].join("\r\n") + "\r\n",
  "utf8",
);

console.log("Generated fixtures in", root);
