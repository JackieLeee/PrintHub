/**
 * One-off verifier for Jackie’s 80/58 text + image base64 samples.
 * Run: pnpm --filter @virt-printer/escpos exec tsx src/verify-samples.ts [path-to.b64 ...]
 */
import { readFileSync } from "node:fs";
import { parseEscPosInspector } from "./inspector/parser.js";
import {
  PAPER_WIDTH_58MM,
  PAPER_WIDTH_80MM,
  receiptCellCount,
} from "./paper-width.js";

const B64_80_TEXT =
  "G0AbYQAbRwEdIQAbdAAcJhtNACAgICAgICAgICAgICAgICAgILTy06Gy4srUICAgICAgICAgICAgICAgICAgChtAG2EAHSEAG3QAHCYbTQDXwMyoOjEyQyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjIDAwMDEKG0AbYQAdIQAbdAAcJhtNAMDg0M0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgzMPKswobQBthAB0hABt0ABwmG00AsbjXoiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTm90IHNwaWN5ChtAG2EAHSEAG3QAHCYbTQAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KG0AbYQAdIQAbdAAcJhtNAMP7s8YgICAgICAgICAgICAgICAgICDK/cG/ICAgICAgICAgICAgICAgICAg0KG8xgobQBthAB0hABt0ABwmG00ALS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tChtAG2EAHSEAG3QAHCYbTQBCZWVmIGFuZCBNdXNocm9vbSBCdXJnIDIgICAgICAgICAgICAgICAgMiwyMjQuNDQKG0AbYQAdIQAbdAAcJhtNAFR1cmtpc2ggKEJpZyktMS4yMzBrZwobQBthAB0hABt0ABwmG00AICAgIHRlc3Qgc3BlY2lhbCBkaXNjb3VudNXbv9sgICAgICAgICAgICAgLTEwLjAwChtAG2EAHSEAG3QAHCYbTQBCZWVmIGFuZCBNdXNocm9vbSBCdXJnIDIgICAgICAgICAgICAgICAgMiwyMjQuNDQKG0AbYQAdIQAbdAAcJhtNAFR1cmtpc2ggKEJpZyktMS4yMzBrZwobQBthAB0hABt0ABwmG00AICAgIHRlc3Qgc3BlY2lhbCBkaXNjb3VudNXbv9sgICAgICAgICAgICAgLTEwLjAwChtAG2EAHSEAG3QAHCYbTQBCZWVmIGFuZCBNdXNocm9vbSBCdXJnIDIgICAgICAgICAgICAgICAgMiwyMjQuNDQKG0AbYQAdIQAbdAAcJhtNAFR1cmtpc2ggKEJpZyktMS4yMzBrZwobQBthAB0hABt0ABwmG00AICAgIHRlc3Qgc3BlY2lhbCBkaXNjb3VudNXbv9sgICAgICAgICAgICAgLTEwLjAwChtAG2EAHSEAG3QAHCYbTQAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KG0AbYQAdIQAbdAAcJhtNALLLxre98LbuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEsMjM0LDU2Ny44OQobQBthAB0hABt0ABwmG00Ay7AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAyLjAwChtAG2EAHSEAG3QAHCYbTQAgICDX3LzGICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxLDIzNCw1NjcuODkKG0AbYQAdIQAbdAAcJhtNAC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQobQBthAB0hABt0ABwmG00Atqm1pbHgusUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAzMjQzNTQzNTQ2ChtAG2EAHSEAG3QAHCYbTQDAtNS0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBXYWl0aWVyOlJpY2sKG0AbYQAdIQAbdAAcJhtNALaptaXKsbzkICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEyLTIyICAyMjoyMgobQBthAB0hABt0ABwmG00Atqm1pcqxvOQgICAgICAgICAgICAgICAgICAgICAgICAgICAgMTItMjIgIDIyOjIyChtAG2EAHSEAG3QAHCYbTQAgChtAG2EAHSEAG3QAHCYbTQAgCg==";

const B64_58_TEXT =
  "G0AbYQAbRwEdIQAbdAAcJhtNACAgICAgICAgICAgILTy06Gy4srUICAgICAgICAgICAgChtAG2EAHSEAG3QAHCYbTQDXwMyoOjEyQyAgICAgICAgICAgICAgICAgICMgMDAwMQobQBthAB0hABt0ABwmG00AwODQzSAgICAgICAgICAgICAgICAgICAgICAgIMzDyrMKG0AbYQAdIQAbdAAcJhtNALG416IgICAgICAgICAgICAgICAgICAgTm90IHNwaWN5ChtAG2EAHSEAG3QAHCYbTQAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQobQBthAB0hABt0ABwmG00Aw/uzxiAgICAgICAgICAgICDK/cG/ICAgICAgINChvMYKG0AbYQAdIQAbdAAcJhtNAC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tChtAG2EAHSEAG3QAHCYbTQBCZWVmIGFuZCBNdXNocm9vbSAyICAgICAyLDIyNC40NAobQBthAB0hABt0ABwmG00AQnVyZyBUdXJraXNoChtAG2EAHSEAG3QAHCYbTQAoQmlnKS0xLjIzMGtnChtAG2EAHSEAG3QAHCYbTQAgICAgdGVzdCBzcGVjaWFsICAgICAgICAgIC0xMC4wMAobQBthAB0hABt0ABwmG00AICAgIGRpc2NvdW501du/2wobQBthAB0hABt0ABwmG00AQmVlZiBhbmQgTXVzaHJvb20gMiAgICAgMiwyMjQuNDQKG0AbYQAdIQAbdAAcJhtNAEJ1cmcgVHVya2lzaAobQBthAB0hABt0ABwmG00AKEJpZyktMS4yMzBrZwobQBthAB0hABt0ABwmG00AICAgIHRlc3Qgc3BlY2lhbCAgICAgICAgICAtMTAuMDAKG0AbYQAdIQAbdAAcJhtNACAgICBkaXNjb3VudNXbv9sKG0AbYQAdIQAbdAAcJhtNAEJlZWYgYW5kIE11c2hyb29tIDIgICAgIDIsMjI0LjQ0ChtAG2EAHSEAG3QAHCYbTQBCdXJnIFR1cmtpc2gKG0AbYQAdIQAbdAAcJhtNAChCaWcpLTEuMjMwa2cKG0AbYQAdIQAbdAAcJhtNACAgICB0ZXN0IHNwZWNpYWwgICAgICAgICAgLTEwLjAwChtAG2EAHSEAG3QAHCYbTQAgICAgZGlzY291bnTV27/bChtAG2EAHSEAG3QAHCYbTQAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQobQBthAB0hABt0ABwmG00AssvGt73wtu4gICAgICAgICAgICAxLDIzNCw1NjcuODkKG0AbYQAdIQAbdAAcJhtNAMuwICAgICAgICAgICAgICAgICAgICAgICAgICAyLjAwChtAG2EAHSEAG3QAHCYbTQAgICDX3LzGICAgICAgICAgICAgIDEsMjM0LDU2Ny44OQobQBthAB0hABt0ABwmG00ALS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KG0AbYQAdIQAbdAAcJhtNALaptaWx4LrFICAgICAgICAgICAgICAzMjQzNTQzNTQ2ChtAG2EAHSEAG3QAHCYbTQDAtNS0ICAgICAgICAgICAgICAgIFdhaXRpZXI6UmljawobQBthAB0hABt0ABwmG00Atqm1pcqxvOQgICAgICAgICAgICAxMi0yMiAgMjI6MjIKG0AbYQAdIQAbdAAcJhtNALaptaXKsbzkICAgICAgICAgICAgMTItMjIgIDIyOjIyChtAG2EAHSEAG3QAHCYbTQAgChtAG2EAHSEAG3QAHCYbTQAgCg==";

function decodeB64(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, "");
  return Uint8Array.from(Buffer.from(clean, "base64"));
}

/** Node-safe raster width hint (no canvas). */
function rasterWidthHint(data: Uint8Array): number {
  let max = 0;
  for (let i = 0; i < data.length - 5; i++) {
    if (data[i] === 0x1b && data[i + 1] === 0x2a) {
      const mode = data[i + 2]!;
      const width = data[i + 3]! + data[i + 4]! * 256;
      max = Math.max(max, width);
      i += 4;
    }
    if (data[i] === 0x1d && data[i + 1] === 0x76 && data[i + 2] === 0x30) {
      const wBytes = data[i + 4]! + data[i + 5]! * 256;
      max = Math.max(max, wBytes * 8);
      i += 5;
    }
  }
  return max;
}

function analyze(name: string, data: Uint8Array): void {
  let commands: ReturnType<typeof parseEscPosInspector>["commands"] = [];
  let paperWidth = PAPER_WIDTH_58MM;
  let warnings: string[] = [];
  try {
    ({ commands, paperWidth, warnings } = parseEscPosInspector(data));
  } catch (err) {
    const hint = rasterWidthHint(data);
    paperWidth = hint >= 512 ? PAPER_WIDTH_80MM : hint > 0 ? PAPER_WIDTH_58MM : PAPER_WIDTH_58MM;
    warnings = [`parse partial (${err instanceof Error ? err.message : String(err)})`];
  }
  const texts = commands.filter((c) => c.category === "text").map((c) => (c as { text: string }).text);
  const joined = texts.join("\n");
  const images = commands.filter((c) => c.category === "image" || c.category === "rasterImage");
  const maxRaster = Math.max(
    images.reduce((m, c) => Math.max(m, (c as { width?: number }).width ?? 0), 0),
    rasterWidthHint(data),
  );
  const maxCols = texts.reduce((m, t) => Math.max(m, ...t.split("\n").map(receiptCellCount)), 0);

  console.log(`\n=== ${name} ===`);
  console.log(`  bytes: ${data.length}`);
  console.log(`  paperWidth: ${paperWidth}px (expect 58→${PAPER_WIDTH_58MM}, 80→${PAPER_WIDTH_80MM})`);
  console.log(`  maxCols: ${maxCols}, maxRaster: ${maxRaster}px`);
  console.log(`  image cmds: ${images.length}, text cmds: ${texts.length}`);
  if (joined) {
    console.log(`  税: ${joined.includes("税")}, ˰(bad): ${joined.includes("˰")}`);
    const taxLine = texts.find((t) => t.includes("税") || t.includes("˰"));
    if (taxLine) console.log(`  tax line: ${JSON.stringify(taxLine.trim())}`);
  }
  if (warnings.length) console.log(`  warnings: ${warnings.slice(0, 3).join("; ")}`);
}

const builtIn: Array<[string, string]> = [
  ["80mm-text", B64_80_TEXT],
  ["58mm-text", B64_58_TEXT],
];

for (const [name, b64] of builtIn) {
  analyze(name, decodeB64(b64));
}

for (const path of process.argv.slice(2)) {
  const b64 = readFileSync(path, "utf8").replace(/\s+/g, "");
  analyze(path, decodeB64(b64));
}
