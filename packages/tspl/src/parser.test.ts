import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { decodeBitmapFromHex } from "./bitmap.js";
import { parseTspl } from "./parser.js";
import { bitmapByteLength, hexToBytes } from "./utils.js";

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("parseTspl", () => {
  it("parses SIZE, TEXT, BARCODE, PRINT", () => {
    const payload = enc(
      'SIZE 40 mm,30 mm\nGAP 2 mm,0\nCLS\nTEXT 20,20,"4",0,1,1,"Hello Label"\nBARCODE 20,80,"128",40,1,0,2,4,"123456"\nPRINT 1\n',
    );
    const { commands } = parseTspl(payload);
    strictEqual(commands.some((c) => c.kind === "size" && c.width === 40), true);
    strictEqual(commands.some((c) => c.kind === "text" && c.content === "Hello Label"), true);
    strictEqual(commands.some((c) => c.kind === "barcode" && c.data === "123456"), true);
    strictEqual(commands.some((c) => c.kind === "print"), true);
  });

  it("parses BOX, QRCODE, CIRCLE", () => {
    const payload = enc(
      'SIZE 50,30\nBOX 10,10,200,100,2\nQRCODE 30,30,M,4,A,"https://example.com"\nCIRCLE 100,100,40,2\n',
    );
    const { commands } = parseTspl(payload);
    strictEqual(commands.some((c) => c.kind === "box"), true);
    strictEqual(commands.some((c) => c.kind === "qrcode" && c.data.includes("example")), true);
    strictEqual(commands.some((c) => c.kind === "circle"), true);
  });

  it("parses BITMAP with inline hex", () => {
    const width = 16;
    const height = 2;
    const bytes = bitmapByteLength(width, height);
    const hex = "ff".repeat(bytes);
    const payload = enc(`SIZE 40 mm,10 mm\nBITMAP 10,10,${width},${height},0,${hex}\n`);
    const { commands } = parseTspl(payload);
    const bmp = commands.find((c) => c.kind === "bitmap");
    strictEqual(bmp?.kind, "bitmap");
    if (bmp?.kind === "bitmap") {
      strictEqual(bmp.width, width);
      strictEqual(bmp.height, height);
      strictEqual(bmp.data.length, bytes);
    }
  });

  it("parses BITMAP with trailing binary", () => {
    const width = 8;
    const height = 1;
    const bytes = bitmapByteLength(width, height);
    const binary = new Uint8Array(bytes).fill(0xaa);
    const header = enc(`BITMAP 0,0,${width},${height},0,\n`);
    const payload = new Uint8Array(header.length + binary.length);
    payload.set(header, 0);
    payload.set(binary, header.length);
    const { commands } = parseTspl(payload);
    const bmp = commands.find((c) => c.kind === "bitmap");
    strictEqual(bmp?.kind, "bitmap");
    if (bmp?.kind === "bitmap") {
      strictEqual(bmp.data[0], 0xaa);
    }
  });

  it("decodes hex bitmap helper", () => {
    const data = decodeBitmapFromHex("ff00", 8, 1);
    strictEqual(data.length, 1);
    strictEqual(data[0], 0xff);
  });

  it("hexToBytes strips whitespace", () => {
    const b = hexToBytes("ff ee");
    strictEqual(b.length, 2);
    strictEqual(b[0], 0xff);
    strictEqual(b[1], 0xee);
  });
});
