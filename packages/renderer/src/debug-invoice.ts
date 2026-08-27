/**
 * Debug Jackie service-invoice base64 — parse + layout elements (no canvas).
 * Run: pnpm --filter @virt-printer/escpos exec tsx ../renderer/src/debug-invoice.ts
 */
import { parseEscPosInspector, receiptCellCount, columnsForPaperWidth } from "@virt-printer/escpos";
import {
  buildRenderElements,
  mergeSegmentsToGridString,
  segmentStartCol,
} from "./canvas-renderer.js";
import { DEFAULT_RECEIPT_LAYOUT } from "./receipt-layout.js";

const B64 = `G0AbYQAdIQAbRQAdIQAbdAAcJhtNACAKG2EAHSEAG0UAHSEAG3QAHCYbTQAgChthAR0hABtFAB0hABt0ABwmG00AICAgICAgICAgICAgICAgICAgIFRyYWRlIE5hbWUgICAgICAgICAgICAgICAgICAgChthAR0hABtFAB0hABt0ABwmG00AICAgICAgICAgICAgIFJlZ2lzdGVyZWQgTmFtZSCoQyBQcm9wICAgICAgICAgICAgIAobYQEdIQAbRQAdIQAbdAAcJhtNACAgICAgICAgICAgICAgICBUYXhwYXllciBBZGRyZXNzICAgICAgICAgICAgICAgIAobYQEdIQAbRQAdIQAbdAAcJhtNACAgICAgICAgICAgICAgICBWQVQgUmVnLiBUSU46VGluICAgICAgICAgICAgICAgIAobYQEdIQAbRQAdIQAbdAAcJhtNAC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQobYQEdIQAbRQAdIQAbdAAcJhtNACAgICAgICAgICAgICAgICAgU2VydmljZSBJbnZvaWNlICAgICAgICAgICAgICAgIAobYQEdIQAbRQAdIQAbdAAcJhtNAC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQobYQAdIQAbRQAdIQAbdAAcJhtNAFNlcnZpY2UgSW52b2ljZSBObzowMDAwMDAwMDA1MDQgICAgICAgICAgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAFN0b3JlIE5vOlN0b3JlIE51bWJlciAgICAgICAgICAgICAgICAgICAgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAFRyYW5zYWN0aW9uIE5vOjAwMDAwMDAwMDU0MiAgICAgICAgICAgICAgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAENhc2hpZXIgTmFtZTpiaXJAdGVzdC5jb20gICAgICAgICAgICAgICAgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAERhdGU6MjQvMDgvMjAyNiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAFRpbWU6MTE6NDFhbSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAE9QIGlkOjIyMjYwODI0MDAxVldXREFTQkkgICAgICAgICAgICAgICAgICAgICAgIAobYQEdIQAbRQAdIQAbdAAcJhtNAC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQobYQEdIQAbRQAdIQAbdAAcJhtNACAgICAgICAgICAgICAgICAgICAgVEFLRUFXQVkgICAgICAgICAgICAgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAFRhYmxlOiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIBthAh0hABtFAB0hABt0ABwmG00AICNCMDUwChthAR0hABtFAB0hABt0ABwmG00ALS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tChthAB0hABtFAB0hABt0ABwmG00ASXRlbSAgICAgICAgICAgICAgICAgICAgICAgICAgIBthAR0hABtFAB0hABt0ABwmG00AIFByaWNlG2EBHSEAG0UAHSEAG3QAHCYbTQAgUXR5G2ECHSEAG0UAHSEAG3QAHCYbTQAgQW1vdW50ChthAR0hABtFAB0hABt0ABwmG00ALS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tChthAB0hABtFAB0hABt0ABwmG00AsuLK1CAgICAgICAgICAgICAgICAgICAgICAgICAgIBthAR0hABtFAB0hABt0ABwmG00AIDIwLjAwG2EBHSEAG0UAHSEAG3QAHCYbTQAgIDEgG2ECHSEAG0UAHSEAG3QAHCYbTQAgIDIwLjAwChthAR0hABtFAB0hABt0ABwmG00ALS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tChthAB0hABtFAR0hABt0ABwmG00AssvGt73wtu4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgG2ECHSEAG0UAHSEAG3QAHCYbTQAgMjAuMDAKG2EAHSEAG0UBHSEAG3QAHCYbTQDQobzGICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAbYQIdIQAbRQAdIQAbdAAcJhtNACAyMC4wMAobYQEdIQAbRQAdIQAbdAAcJhtNAC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQobYQAdIQAbRQEdIQAbdAAcJhtNALLLxreyu7qsy7C98LbuICAgICAgICAgICAgICAgICAgICAgICAgICAgIBthAh0hABtFAB0hABt0ABwmG00AIDE4Ljg3ChthAB0hABtFAR0hABt0ABwmG00At/7O8bfRICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgG2ECHSEAG0UAHSEAG3QAHCYbTQAgIDEuODkKG2EAHSEAG0UBHSEAG3QAHCYbTQC5zLaoMTAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAbYQIdIQAbRQAdIQAbdAAcJhtNACAxMC4wMAobYQAdIQAbRQEdIQAbdAAcJhtNAFZhdCg2JSkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAbYQIdIQAbRQAdIQAbdAAcJhtNACAxLjg0ChthAB0hARtFAR0hARt0ABwmG00A19zP+srbtu4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgG2ECHSEBG0UAHSEBG3QAHCYbTQAgMzIuNjAKG2EBHSEAG0UAHSEAG3QAHCYbTQAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KG2EAHSEAG0UAHSEAG3QAHCYbTQBQYXltZW50IE1ldGhvZCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKG2EAHSEAG0UAHSEAG3QAHCYbTQDP1r3wICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAbYQIdIQAbRQAdIQAbdAAcJhtNACAzMi42MAobYQEdIQAbRQAdIQAbdAAcJhtNAC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQobYQAdIQAbRQAdIQAbdAAcJhtNAFZBVGFibGUgU2FsZXMgICAgICAgICAgICAgICAgICAgICAgICAgICAgIBthAh0hABtFAB0hABt0ABwmG00AIDMwLjc2ChthAB0hABtFAB0hABt0ABwmG00AVkFUIEFtb3VudCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIBthAh0hABtFAB0hABt0ABwmG00AIDEuODQKG2EAHSEAG0UAHSEAG3QAHCYbTQBWQVQgRXhlbXB0IFNhbGVzICAgICAgICAgICAgICAgICAgICAgICAgICAgG2ECHSEAG0UAHSEAG3QAHCYbTQAgMC4wMAobYQAdIQAbRQAdIQAbdAAcJhtNAFplcm8gUmF0ZWQgU2FsZXMgICAgICAgICAgICAgICAgICAgICAgICAgICAbYQIdIQAbRQAdIQAbdAAcJhtNACAwLjAwChthAB0hABtFAB0hABt0ABwmG00AIAobYQAdIQAbRQAdIQAbdAAcJhtNACAKG2EBHSEAG0UAHSEAG3QAHCYbTQAgICAgICAgIFRISVMgU0VSVkVTIEFTIFlPVVIgU0FMRVMgSU5WT0lDRSAgICAgICAKG2EAHSEAG0UAHSEAG3QAHCYbTQAgChthAB0hABtFAB0hABt0ABwmG00AIAobYQAdIQAbRQAdIQAbdAAcJhtNAFBPUyBQcm92aWRlcjpUZWNoIE1pbmQgQW5kIERpZ2l0YWwgTGVhcCBJbmMuICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAFVuaXQgMTEwMC1CIDExdGggRmxvb3IsIFZpY2VudGUgTWFkcmlnYWwgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAEJ1aWxkaW5nLCA2NzkzIEF5YWxhIEF2ZW51ZSBCZWwtQWlyIDEyMDkgQ2l0eSBvZgobYQAdIQAbRQAdIQAbdAAcJhtNAE1ha2F0aSBOQ1IgRm91cnRoIERpc3RyaWN0IFBoaWxpcHBpbmVzICAgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAFZBVCBSZWcuIFRJTjo2MjYtNDY5LTAwNi0wMDAwMCAgICAgICAgICAgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAEFjY3JlZGl0YXRpb24gTm86MDUwNjI2NDY5MDA2MjAyNTA2MjM2NSAgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAERhdGUgSXNzdWVkOjIwMjUtMDgtMTEgICAgICAgICAgICAgICAgICAgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAFZhbGlkIFVudGlsOjIwMzAtMDgtMTEgICAgICAgICAgICAgICAgICAgICAgICAgIAobYQEdIQAbRQAdIQAbdAAcJhtNAC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQobYQAdIQAbRQAdIQAbdAAcJhtNAE5hbWU6ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAFRJTjogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAEFkZHJlc3M6ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNAFNpZ25hdHVyZTogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAobYQAdIQAbRQAdIQAbdAAcJhtNACAKG2EAHSEAG0UAHSEAG3QAHCYbTQAgChthAB0hABtFAB0hABt0ABwmG00AIAobYQAdIQAbRQAdIQAbdAAcJhtNACAK`;

const data = Uint8Array.from(Buffer.from(B64.replace(/\s+/g, ""), "base64"));
const { commands, paperWidth, warnings } = parseEscPosInspector(data);
const maxCols = columnsForPaperWidth(paperWidth);
const layout = DEFAULT_RECEIPT_LAYOUT;
const elements = buildRenderElements(commands, paperWidth, layout);

console.log("bytes:", data.length);
console.log("paperWidth:", paperWidth, "cols:", maxCols);
console.log("warnings:", warnings.length ? warnings.slice(0, 5) : "none");

const textEls = elements.filter((e) => e.type === "text");
console.log("text elements:", textEls.length);

function showLine(label: string, content: string, extra: Record<string, unknown> = {}) {
  const cols = receiptCellCount(content);
  console.log(`\n[${label}] cols=${cols} ${JSON.stringify(extra)}`);
  console.log(JSON.stringify(content));
}

for (const el of textEls) {
  const c = el.content ?? "";
  if (
    c.includes("---") ||
    c.includes("Item") ||
    c.includes("测试") ||
    c.includes("菜品") ||
    c.includes("总销售") ||
    c.includes("VAT") ||
    c.includes("Table") ||
    c.includes("B050") ||
    el.mergedCommandIds ||
    c.includes("菜品") ||
    c.includes("总销售")
  ) {
    showLine(
      el.mergedCommandIds ? "merged" : "text",
      c,
      {
        x: el.x,
        width: el.width,
        bold: el.bold,
        merged: el.mergedCommandIds?.length,
      },
    );
  }
}

// Simulate multi-segment lines from raw commands for header row
const texts = commands.filter((c) => c.category === "text") as Array<{ text: string; id: string }>;
let pending: Array<{ content: string; alignment: string; bold?: boolean }> = [];
let align = "left";
let bold = false;
const flush = () => {
  if (pending.length > 1) {
    const merged = mergeSegmentsToGridString(pending, maxCols);
    console.log("\n[raw multi-seg]", pending.length, "segments");
    pending.forEach((s, i) => {
      console.log(
        `  seg${i} ${s.alignment} col=${segmentStartCol(pending, i, maxCols)} cols=${receiptCellCount(s.content)} bold=${s.bold} ${JSON.stringify(s.content.slice(0, 40))}`,
      );
    });
    console.log("  merged len:", merged.length, "tail:", JSON.stringify(merged.slice(-12)));
  }
  pending = [];
};
for (const cmd of commands) {
  if (cmd.category === "alignment") align = cmd.alignment;
  if (cmd.category === "style" && cmd.bold !== undefined) bold = cmd.bold;
  if (cmd.category === "font") bold = cmd.bold;
  if (cmd.category === "text") {
    const parts = cmd.text.split("\n");
    for (let i = 0; i < parts.length; i++) {
      if (parts[i]!.length) pending.push({ content: parts[i]!, alignment: align, bold });
      if (i < parts.length - 1) flush();
    }
    if (cmd.text.endsWith("\n")) flush();
  }
  if (cmd.category === "lineFeed" || cmd.category === "feed") flush();
}
if (pending.length) flush();

console.log("\n=== font trace ===");
let fAlign = "left";
let fBold = false;
let fCw = 1;
let fCh = 1;
for (const cmd of commands) {
  if (cmd.category === "alignment") fAlign = cmd.alignment;
  if (cmd.category === "font") {
    fCw = cmd.width;
    fCh = cmd.height;
    fBold = cmd.bold;
  }
  if (cmd.category === "style" && cmd.bold !== undefined) fBold = cmd.bold;
  if (cmd.category === "text") {
    const t = cmd.text.replace(/\n$/, "");
    if (/总销售|小计|Vat|Table|Item|测试|菜品|现金/.test(t) || fCw > 1 || fCh > 1) {
      console.log(JSON.stringify({ align: fAlign, cw: fCw, ch: fCh, bold: fBold, cols: receiptCellCount(t), text: t.slice(0, 50) }));
    }
  }
}
