import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import type { ParsedCommand } from "@virt-printer/escpos";
import { COLS_80MM, receiptCellCount } from "@virt-printer/escpos";
import { buildRenderElements, mergeSegmentsToGridString, segmentStartCol } from "./canvas-renderer.js";
import { DEFAULT_RECEIPT_LAYOUT } from "./receipt-layout.js";

describe("segmentStartCol", () => {
  it("places 4-column item row on 48-col paper", () => {
    const segments = [
      { content: "Item                           ", alignment: "left" as const },
      { content: " Price", alignment: "center" as const },
      { content: " Qty", alignment: "center" as const },
      { content: " Amount\n", alignment: "right" as const },
    ];
    strictEqual(segmentStartCol(segments, 0, COLS_80MM), 0);
    strictEqual(segmentStartCol(segments, 1, COLS_80MM), 31);
    strictEqual(segmentStartCol(segments, 2, COLS_80MM), 37);
    strictEqual(segmentStartCol(segments, 3, COLS_80MM), 40);
  });

  it("places label/value pairs with right field anchored to margin", () => {
    const segments = [
      { content: "菜品金额                                  ", alignment: "left" as const },
      { content: " 20.00\n", alignment: "right" as const },
    ];
    strictEqual(segmentStartCol(segments, 0, COLS_80MM), 0);
    strictEqual(segmentStartCol(segments, 1, COLS_80MM), 41);
  });
});

describe("mergeSegmentsToGridString", () => {
  it("merges 4-column item row into one 48-col line", () => {
    const segments = [
      { content: "Item                           ", alignment: "left" as const },
      { content: " Price", alignment: "center" as const },
      { content: " Qty", alignment: "center" as const },
      { content: " Amount", alignment: "right" as const },
    ];
    const merged = mergeSegmentsToGridString(segments, COLS_80MM);
    strictEqual(merged.length, 48);
    strictEqual(merged.slice(31, 37), " Price");
    strictEqual(merged.slice(37, 41), " Qty");
    // Qty ends at col 40; Amount (7 cols) starts at col 41 — one-column overlap like the printer.
    strictEqual(merged.slice(40, 48), "y Amount");
  });
});

describe("buildRenderElements", () => {
  it("places mixed bold label and right amount on the column grid", () => {
    const commands: ParsedCommand[] = [
      { id: "a", category: "alignment", alignment: "left" },
      { id: "b", category: "style", bold: true },
      { id: "c", category: "text", text: "菜品金额                                  " },
      { id: "d", category: "alignment", alignment: "right" },
      { id: "e", category: "style", bold: false },
      { id: "f", category: "text", text: " 20.00\n" },
    ];
    const elements = buildRenderElements(commands, 576, DEFAULT_RECEIPT_LAYOUT);
    const label = elements.find((e) => e.content === "菜品金额");
    const amount = elements.find((e) => e.content === " 20.00");
    strictEqual(label?.x, 8);
    strictEqual(label?.bold, true);
    strictEqual(amount?.x, 8 + 42 * 12);
    strictEqual(amount?.bold, false);
  });

  it("merges CJK item row to 48 columns on 80mm paper", () => {
    const commands: ParsedCommand[] = [
      { id: "1", category: "alignment", alignment: "left" },
      { id: "2", category: "text", text: "测试                           " },
      { id: "3", category: "alignment", alignment: "center" },
      { id: "4", category: "text", text: " 20.00" },
      { id: "5", category: "alignment", alignment: "center" },
      { id: "6", category: "text", text: "  1 " },
      { id: "7", category: "alignment", alignment: "right" },
      { id: "8", category: "text", text: "  20.00\n" },
    ];
    const elements = buildRenderElements(commands, 576, DEFAULT_RECEIPT_LAYOUT);
    const row = elements.find((e) => e.content?.includes("测试"));
    strictEqual(receiptCellCount(row?.content ?? ""), 48);
    strictEqual(row?.x, 8);
  });

  it("feeds multiple lines for ESC d n and dot units for ESC J", () => {
    const singleFeed: ParsedCommand[] = [
      { id: "f1", category: "feed", lines: 1, unit: "lines" },
    ];
    const tripleFeed: ParsedCommand[] = [
      { id: "f3", category: "feed", lines: 3, unit: "lines" },
    ];
    const dotFeed: ParsedCommand[] = [
      { id: "fj", category: "feed", lines: 24, unit: "dots" },
    ];
    const single = buildRenderElements(singleFeed, 576, DEFAULT_RECEIPT_LAYOUT);
    const triple = buildRenderElements(tripleFeed, 576, DEFAULT_RECEIPT_LAYOUT);
    const dots = buildRenderElements(dotFeed, 576, DEFAULT_RECEIPT_LAYOUT);
    strictEqual(triple[0]?.height, (single[0]?.height ?? 0) * 3);
    strictEqual(dots[0]?.height, 24);
  });

  it("uses ESC 3 line spacing for feed lines", () => {
    const defaultSpacing: ParsedCommand[] = [
      { id: "f", category: "feed", lines: 1, unit: "lines" },
    ];
    const tightSpacing: ParsedCommand[] = [
      { id: "s", category: "lineSpacing", spacing: 20 },
      { id: "f", category: "feed", lines: 1, unit: "lines" },
    ];
    const defaultEl = buildRenderElements(defaultSpacing, 576, DEFAULT_RECEIPT_LAYOUT);
    const tightEl = buildRenderElements(tightSpacing, 576, DEFAULT_RECEIPT_LAYOUT);
    strictEqual(defaultEl[0]?.height, 30);
    strictEqual(tightEl[0]?.height, 20);
  });
});
