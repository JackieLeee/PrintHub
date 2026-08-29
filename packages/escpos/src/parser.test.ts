import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { parseEscPos } from "./parser.js";
import { parseEscPosInspector } from "./inspector/parser.js";
import { isEscPosStatusOrHeartbeat, isMeaningfulPrintJob } from "./heartbeat.js";

function bytes(...vals: number[]): Uint8Array {
  return new Uint8Array(vals);
}

describe("parseEscPos", () => {
  it("parses init, centered bold text, feed and cut", () => {
    const payload = bytes(
      0x1b, 0x40,
      0x1b, 0x61, 0x01,
      0x1b, 0x45, 0x01,
      ...new TextEncoder().encode("TOTAL"),
      0x0a,
      0x1b, 0x64, 0x03,
      0x1d, 0x56, 0x00,
    );
    const { commands } = parseEscPos(payload);
    strictEqual(commands.some((c) => c.kind === "text" && c.text === "TOTAL" && c.bold && c.align === "center"), true);
    strictEqual(commands.some((c) => c.kind === "feed" && c.lines === 3), true);
    strictEqual(commands.some((c) => c.kind === "cut"), true);
  });

  it("parses GS v 0 raster bitmap", () => {
    const raster = new Uint8Array(8).fill(0xff);
    const payload = new Uint8Array([
      0x1d, 0x76, 0x30, 0x00,
      0x01, 0x00,
      0x08, 0x00,
      ...raster,
    ]);
    const { commands } = parseEscPos(payload);
    const rasterCmd = commands.find((c) => c.kind === "raster");
    strictEqual(rasterCmd?.kind, "raster");
    if (rasterCmd?.kind === "raster") {
      strictEqual(rasterCmd.widthBytes, 1);
      strictEqual(rasterCmd.height, 8);
      strictEqual(rasterCmd.data.length, 8);
    }
  });

  it("parses GS k barcode", () => {
    const payload = bytes(
      0x1d, 0x68, 0x50,
      0x1d, 0x48, 0x02,
      0x1d, 0x6b, 0x04,
      ...new TextEncoder().encode("ABC123"),
      0x00,
    );
    const { commands } = parseEscPos(payload);
    const bc = commands.find((c) => c.kind === "barcode");
    strictEqual(bc?.kind, "barcode");
    if (bc?.kind === "barcode") {
      strictEqual(bc.data, "ABC123");
      strictEqual(bc.symbology, "code39");
      strictEqual(bc.hri, "below");
    }
  });

  it("parses underline and double size via ESC !", () => {
    const payload = bytes(
      0x1b, 0x21, 0x30,
      ...new TextEncoder().encode("BIG"),
    );
    const { commands } = parseEscPos(payload);
    const text = commands.find((c) => c.kind === "text");
    strictEqual(text?.kind, "text");
    if (text?.kind === "text") {
      strictEqual(text.doubleWidth, true);
      strictEqual(text.doubleHeight, true);
    }
  });

  it("parses GS ( k QR code sequence from sample receipt", () => {
    const qr = "https://github.com/example/escpos-inspector";
    const payload = bytes(
      0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x05,
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31,
      0x1d, 0x28, 0x6b, qr.length + 3, 0x00, 0x31, 0x50, 0x30,
      ...new TextEncoder().encode(qr),
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,
    );
    const { commands } = parseEscPos(payload);
    const qrCmd = commands.find((c) => c.kind === "qrcode");
    strictEqual(qrCmd?.kind, "qrcode");
    if (qrCmd?.kind === "qrcode") {
      strictEqual(qrCmd.data, qr);
      strictEqual(qrCmd.size, 5);
    }
    strictEqual(commands.some((c) => c.kind === "text" && c.text.includes("(k")), false);
  });

  it("merges consecutive ESC * 24-dot stripes into bitImage", () => {
    const width = 8;
    const wL = width & 0xff;
    const wH = (width >> 8) & 0xff;
    const stripe = new Uint8Array(width * 3).fill(0xff);
    const payload = bytes(
      0x1b, 0x2a, 0x21, wL, wH, ...stripe, 0x0a,
      0x1b, 0x2a, 0x21, wL, wH, ...stripe, 0x0a,
    );
    const { commands } = parseEscPos(payload);
    const img = commands.find((c) => c.kind === "bitImage");
    strictEqual(img?.kind, "bitImage");
    if (img?.kind === "bitImage") {
      strictEqual(img.height, 48);
      strictEqual(img.width, width);
    }
  });

  it("decodes GBK Chinese text", () => {
    // "打印门店" in GBK
    const payload = bytes(0xb4, 0xf2, 0xd3, 0xa1, 0xc3, 0xc5, 0xb5, 0xea, 0x0a);
    const { commands } = parseEscPos(payload);
    const text = commands.find((c) => c.kind === "text");
    strictEqual(text?.kind, "text");
    if (text?.kind === "text") {
      strictEqual(text.text.includes("打印"), true);
      strictEqual(text.text.includes("门店"), true);
    }
  });

  it("decodes GBK Chinese after ESC t 0 and FS & (domestic POS pattern)", () => {
    // 打印测试 in GBK, wrapped in common POS header: ESC t 0, FS &, ESC M 0
    const gbk = bytes(0xb4, 0xf2, 0xd3, 0xa1, 0xb2, 0xe2, 0xca, 0xd4);
    const payload = bytes(
      0x1b, 0x40,
      0x1b, 0x74, 0x00,
      0x1c, 0x26,
      0x1b, 0x4d, 0x00,
      ...gbk,
      0x0a,
    );
    const { commands } = parseEscPos(payload);
    const text = commands.find((c) => c.kind === "text");
    strictEqual(text?.kind, "text");
    if (text?.kind === "text") {
      strictEqual(text.text.includes("打印"), true);
      strictEqual(text.text.includes("测试"), true);
    }
  });

  it("filters GS V + DLE EOT heartbeat as non-print job", () => {
    const heartbeat = Uint8Array.from(atob("HVZCQhAEARAEAQ=="), (c) => c.charCodeAt(0));
    strictEqual(isEscPosStatusOrHeartbeat(heartbeat), true);
    strictEqual(isMeaningfulPrintJob(heartbeat, "escpos"), false);
  });

  it("decodes UTF-8 Chinese when valid", () => {
    const payload = bytes(...new TextEncoder().encode("订单号\n"));
    const { commands } = parseEscPos(payload);
    const text = commands.find((c) => c.kind === "text");
    strictEqual(text?.kind, "text");
    if (text?.kind === "text") {
      strictEqual(text.text.includes("订单"), true);
    }
  });

  it("silently handles DLE EOT status poll and ESC M/G font commands", () => {
    const heartbeat = bytes(0x10, 0x04, 0x01);
    strictEqual(isEscPosStatusOrHeartbeat(heartbeat), true);
    strictEqual(isMeaningfulPrintJob(heartbeat, "escpos"), false);

    const payload = bytes(
      0x1b, 0x40,
      0x1b, 0x4d, 0x01,
      0x1b, 0x47,
      ...new TextEncoder().encode("Hi"),
      0x1b, 0x48,
    );
    const { commands, warnings } = parseEscPos(payload);
    strictEqual(warnings.length, 0);
    const text = commands.find((c) => c.kind === "text");
    strictEqual(text?.kind, "text");
    if (text?.kind === "text") {
      strictEqual(text.text, "Hi");
      strictEqual(text.font, "b");
      strictEqual(text.doubleStrike, true);
    }
  });
});

describe("parseEscPosInspector", () => {
  it("decodes UTF-8 Chinese store receipt", () => {
    const b64 =
      "G0UBICAgICAgICAgIFByaW50IFN0b3JlICAgICAgICAgICAKG0UAICAgICAgICAgICAgIOe7k+i0puWNlSAgICAgICAgICAgICAKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0K5Y2V5Y+3OiBPMjAyNjA4MjYtMDAwMDAzICDotKbljZU6ICAgCksyMDI2MDgyNi0wMDAwMDMgICAgICAgICAgICAgICAgChtFAeiPnOWTgSAgICAgICAgICAgICAg5pWw6YePICAgICDph5Hpop0KG0UATm9vZGxlICAgICAgICAgICAgICAgMSAgICAgMTIwMAobRQEgICAgICAgICAgICAgICAgIOWQiOiuoTogMTIuMDAgQ05ZChtFAC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tChtFAeaWueW8jyAgICAgICAgICAgICAgICAgICAgICAgIOmHkeminQobRQBjYXNoICAgICAgICAgICAgICAgICAgICAgICAgMTIwMAoKCh1WAA==";
    const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const { commands } = parseEscPosInspector(data);
    const joined = commands
      .filter((c) => c.category === "text")
      .map((c) => (c as { text: string }).text)
      .join("\n");
    strictEqual(joined.includes("结账单"), true);
    strictEqual(joined.includes("单号"), true);
    strictEqual(joined.includes("菜品"), true);
    strictEqual(joined.includes("数量"), true);
    strictEqual(joined.includes("合计"), true);
    strictEqual(joined.includes("方式"), true);
    strictEqual(joined.includes("Print Store"), true);
  });

  it("parses ESC G with on/off parameter", () => {
    const payload = bytes(
      0x1b, 0x47, 0x01,
      ...new TextEncoder().encode("X"),
      0x1b, 0x47, 0x00,
    );
    const { commands } = parseEscPosInspector(payload);
    const styles = commands.filter((c) => c.category === "style" && c.label === "Double Strike");
    strictEqual(styles.length, 2);
    strictEqual(styles[0]?.doubleStrike, true);
    strictEqual(styles[1]?.doubleStrike, false);
    strictEqual(commands.some((c) => c.category === "unsupported"), false);
  });

  it("parses ESC [ character table and skips DLE EOT status polls", () => {
    const payload = bytes(
      0x10, 0x04, 0x01,
      0x1b, 0x40,
      0x1b, 0x5b, 0x00,
      ...new TextEncoder().encode("OK"),
    );
    const { commands } = parseEscPosInspector(payload);
    strictEqual(commands.some((c) => c.category === "unsupported"), false);
    strictEqual(commands.some((c) => c.category === "codePage" && c.label === "Character Table"), true);
  });

  it("parses GS @ initialize and FS & Chinese mode as code page commands", () => {
    const payload = bytes(0x1c, 0x26, 0x1d, 0x40, 0x1c, 0x2e);
    const { commands } = parseEscPosInspector(payload);
    strictEqual(commands.filter((c) => c.category === "codePage").length, 2);
    strictEqual(commands.some((c) => c.category === "initialize" && c.description.includes("GS @")), true);
  });

  it("parses ESC i/m cut and legacy GS k barcode", () => {
    const payload = bytes(
      0x1d, 0x68, 0x50,
      0x1d, 0x48, 0x02,
      0x1d, 0x6b, 0x04,
      ...new TextEncoder().encode("ABC123"),
      0x00,
      0x1b, 0x69,
    );
    const { commands } = parseEscPosInspector(payload);
    const bc = commands.find((c) => c.category === "barcode");
    strictEqual(bc?.category, "barcode");
    if (bc?.category === "barcode") {
      strictEqual(bc.data, "ABC123");
      strictEqual(bc.height, 80);
      strictEqual(bc.position, "below");
    }
    strictEqual(commands.some((c) => c.category === "cut" && c.mode === "full"), true);
  });

  it("parses ESC d and ESC J feed with units", () => {
    const payload = bytes(0x1b, 0x64, 0x03, 0x1b, 0x4a, 0x18);
    const { commands } = parseEscPosInspector(payload);
    const feeds = commands.filter((c) => c.category === "feed");
    strictEqual(feeds.length, 2);
    strictEqual((feeds[0] as { lines: number; unit: string }).lines, 3);
    strictEqual((feeds[0] as { unit: string }).unit, "lines");
    strictEqual((feeds[1] as { lines: number; unit: string }).lines, 0x18);
    strictEqual((feeds[1] as { unit: string }).unit, "dots");
  });

  it("applies ESC ! underline bit", () => {
    const payload = bytes(0x1b, 0x21, 0x80, ...new TextEncoder().encode("U"));
    const { commands } = parseEscPosInspector(payload);
    const font = commands.find((c) => c.category === "font");
    strictEqual(font?.category, "font");
    if (font?.category === "font") {
      strictEqual(font.underline, true);
    }
  });

  it("parses barcode after ESC * stripe that ends early at LF", () => {
    const stripeHeader = bytes(0x1b, 0x2a, 0x21, 0x40, 0x00);
    const shortData = new Uint8Array(150).fill(0xff);
    const payload = bytes(
      ...stripeHeader,
      ...shortData,
      0x0a,
      0x1b, 0x32,
      0x1b, 0x61, 0x01,
      0x1d, 0x6b, 0x49, 0x0a,
      ...new TextEncoder().encode("1234567890"),
    );
    const { commands } = parseEscPosInspector(payload);
    strictEqual(
      commands.some((c) => c.category === "barcode" && c.data === "1234567890"),
      true,
    );
    strictEqual(commands.some((c) => c.category === "image"), true);
    strictEqual(commands.some((c) => c.category === "unsupported"), false);
  });

  it("parses GS ( N character table and GS ( A print density", () => {
    const payload = bytes(
      0x1b, 0x40,
      0x1d, 0x28, 0x4e, 0x02, 0x00, 0x30, 0x01,
      0x1d, 0x28, 0x41, 0x02, 0x00, 0x00, 0x40,
      ...new TextEncoder().encode("Density sample\n"),
      0x1d, 0x28, 0x4e, 0x01, 0x00, 0x31,
      0x1b, 0x64, 0x02,
    );
    const { commands, warnings } = parseEscPosInspector(payload);
    strictEqual(warnings.length, 0);
    strictEqual(
      commands.some((c) => c.category === "codePage" && c.code === 1),
      true,
    );
    strictEqual(
      commands.some((c) => c.category === "style" && c.label === "Print Density"),
      true,
    );
    strictEqual(commands.some((c) => c.category === "unsupported"), false);
  });
});
