import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { decodeBitmapFromHex } from "./bitmap.js";
import { formatLabelSize } from "./label-size.js";
import { resolveTsplLabelMeta } from "./meta.js";
import { parseTspl } from "./parser.js";
import { bitmapDataLength, hexToBytes, parseMeasurePair, parseSingleMeasure } from "./utils.js";

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
    const widthBytes = 2;
    const height = 2;
    const bytes = bitmapDataLength(widthBytes, height);
    const hex = "ff".repeat(bytes);
    const payload = enc(`SIZE 40 mm,10 mm\nBITMAP 10,10,${widthBytes},${height},0,${hex}\n`);
    const { commands } = parseTspl(payload);
    const bmp = commands.find((c) => c.kind === "bitmap");
    strictEqual(bmp?.kind, "bitmap");
    if (bmp?.kind === "bitmap") {
      strictEqual(bmp.width, widthBytes);
      strictEqual(bmp.height, height);
      strictEqual(bmp.data.length, bytes);
    }
  });

  it("parses BITMAP with trailing binary", () => {
    const widthBytes = 1;
    const height = 1;
    const bytes = bitmapDataLength(widthBytes, height);
    const binary = new Uint8Array(bytes).fill(0xaa);
    const header = enc(`BITMAP 0,0,${widthBytes},${height},0,\n`);
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
    const data = decodeBitmapFromHex("ff00", 1, 1);
    strictEqual(data.length, 1);
    strictEqual(data[0], 0xff);
  });

  it("hexToBytes strips whitespace", () => {
    const b = hexToBytes("ff ee");
    strictEqual(b.length, 2);
    strictEqual(b[0], 0xff);
    strictEqual(b[1], 0xee);
  });

  it("parses SPEED and DIRECTION without warnings", () => {
    const payload = enc(
      "SIZE 50.0 mm,30.0 mm\nGAP 2.0 mm 0.0 mm\nOFFSET 0.0\nSPEED 5.0\nDIRECTION 1,0\nREFERENCE 0,0\nCLS\nTEXT 22,40,\"TSS24.BF2\",0,1,1,\"Hello\"\nPRINT 1\n",
    );
    const { commands, warnings } = parseTspl(payload);
    strictEqual(warnings.length, 0);
    strictEqual(commands.some((c) => c.kind === "direction" && c.value === 1 && c.mirror === 0), true);
    strictEqual(commands.some((c) => c.kind === "text" && c.content === "Hello"), true);
  });

  it("parses FEED after PRINT without warnings", () => {
    const payload = enc(
      'SIZE 50.0 mm,30.0 mm\nGAP 2.0 mm 0.0 mm\nOFFSET 0.0\nSPEED 5.0\nDENSITY 8\nDIRECTION 1,0\nREFERENCE 0,0\nCLS\nTEXT 22,40,"TSS24.BF2",0,1,1,"#1001 1/1              Pickup"\nPRINT 1\nFEED 20\n',
    );
    const { commands, warnings } = parseTspl(payload);
    strictEqual(warnings.length, 0);
    strictEqual(commands.some((c) => c.kind === "print"), true);
    strictEqual(commands.some((c) => c.kind === "feed" && c.dots === 20), true);
    strictEqual(commands.some((c) => c.kind === "density" && c.level === 8), true);
    strictEqual(commands.some((c) => c.kind === "speed" && c.ips === 5), true);
  });

  it("parses GAP with space-separated mm units", () => {
    const pair = parseMeasurePair("GAP 2.0 mm 0.0 mm");
    strictEqual(pair.first.value, 2);
    strictEqual(pair.first.unit, "mm");
    strictEqual(pair.second.value, 0);
    strictEqual(pair.second.unit, "mm");

    const { commands } = parseTspl(enc("SIZE 50 mm,30 mm\nGAP 2.0 mm 0.0 mm\nCLS\nPRINT 1\n"));
    const gap = commands.find((c) => c.kind === "gap");
    strictEqual(gap?.kind === "gap" && gap.value === 2 && gap.sensorOffset === 0 && gap.unit === "mm", true);
  });

  it("parses OFFSET as single feed offset measure", () => {
    strictEqual(parseSingleMeasure("OFFSET 0.0").value, 0);
    const { commands } = parseTspl(enc("SIZE 40 mm,30 mm\nOFFSET 12.7 mm\nCLS\nPRINT 1\n"));
    const offset = commands.find((c) => c.kind === "offset");
    strictEqual(offset?.kind === "offset" && offset.value === 12.7 && offset.unit === "mm", true);
  });

  it("resolveTsplLabelMeta collects layout and hardware settings", () => {
    const payload = enc(
      "SIZE 50.0 mm,30.0 mm\nGAP 2.0 mm 0.0 mm\nOFFSET 0.0\nSPEED 5.0\nDENSITY 8\nDIRECTION 1,0\nREFERENCE 10,20\nSHIFT 0,5\nCLS\nPRINT 1\nFEED 20\n",
    );
    const { commands } = parseTspl(payload);
    const meta = resolveTsplLabelMeta(commands);
    strictEqual(meta.widthDots, 400);
    strictEqual(meta.heightDots, 240);
    strictEqual(meta.direction, 1);
    strictEqual(meta.reference.x, 10);
    strictEqual(meta.shift.y, 5);
    strictEqual(meta.gap?.valueDots, 16);
    strictEqual(meta.feedOffsetDots, 0);
    strictEqual(meta.speed, 5);
    strictEqual(meta.density, 8);
  });

  it("parses DIRECTION mirror flag", () => {
    const payload = enc("SIZE 40 mm,30 mm\nDIRECTION 0,1\nCLS\nPRINT 1\n");
    const { commands } = parseTspl(payload);
    const dir = commands.find((c) => c.kind === "direction");
    strictEqual(dir?.kind === "direction" && dir.value === 0 && dir.mirror === 1, true);
  });

  it("formats label size from SIZE command", () => {
    const payload = enc("SIZE 50.0 mm,30.0 mm\nCLS\nPRINT 1\n");
    const { commands } = parseTspl(payload);
    strictEqual(formatLabelSize(commands), "50×30 mm");
  });

  it("parses 50x30 mm label bitmap (width in bytes)", () => {
    const widthBytes = 50;
    const height = 227;
    const bytes = bitmapDataLength(widthBytes, height);
    const binary = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++) binary[i] = i % 256;
    const header = enc(`SIZE 50.0 mm,30.0 mm\nCLS\nBITMAP 0,0,${widthBytes},${height},0,\n`);
    const payload = new Uint8Array(header.length + binary.length);
    payload.set(header, 0);
    payload.set(binary, header.length);
    const { commands, warnings } = parseTspl(payload);
    strictEqual(warnings.length, 0);
    const bmp = commands.find((c) => c.kind === "bitmap");
    strictEqual(bmp?.kind, "bitmap");
    if (bmp?.kind === "bitmap") {
      strictEqual(bmp.width, widthBytes);
      strictEqual(bmp.height, height);
      strictEqual(bmp.data.length, bytes);
    }
    strictEqual(formatLabelSize(commands), "50×30 mm");
  });

  it("parses bitmap binary containing newline bytes on same line", () => {
    const widthBytes = 4;
    const height = 3;
    const bytes = bitmapDataLength(widthBytes, height);
    const binary = new Uint8Array(bytes);
    binary.fill(0xff);
    binary[2] = 0x0a;
    binary[5] = 0x0d;
    const header = enc(`SIZE 50.0 mm,30.0 mm\nCLS\nBITMAP 0,0,${widthBytes},${height},0,`);
    const payload = new Uint8Array(header.length + binary.length + 1);
    payload.set(header, 0);
    payload.set(binary, header.length);
    payload.set(enc("\n"), header.length + binary.length);
    const { commands } = parseTspl(payload);
    const bmp = commands.find((c) => c.kind === "bitmap");
    strictEqual(bmp?.kind, "bitmap");
    if (bmp?.kind === "bitmap") {
      strictEqual(bmp.data.length, bytes);
      strictEqual(bmp.data[2], 0x0a);
    }
  });
});
