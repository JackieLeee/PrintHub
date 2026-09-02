import { strictEqual, ok } from "node:assert";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parseEscPosInspector } from "@virt-printer/escpos";
import { parseTspl } from "@virt-printer/tspl";
import { buildEscPosBlocks, buildTsplBlocks } from "@virt-printer/analyze";

const here = dirname(fileURLToPath(import.meta.url));
const escposDir = join(here, "../escpos");

function escposRows(bytes: Uint8Array) {
  const { commands } = parseEscPosInspector(bytes);
  return {
    commands,
    rows: commands.map((cmd) => ({
      commandId: cmd.id,
      index: cmd.index,
      category: cmd.category,
      label: cmd.label,
      offset: cmd.span.offset,
      length: cmd.span.length,
      detail: cmd.category === "text" ? cmd.text : cmd.label,
      previewable: ["text", "image", "rasterImage", "barcode", "qrCode"].includes(cmd.category),
    })),
  };
}

describe("inspector blocks", () => {
  it("merges ESC/POS state commands into text composites", () => {
    const bytes = readFileSync(join(escposDir, "align-bold-cut.bin"));
    const { commands, rows } = escposRows(bytes);
    const blocks = buildEscPosBlocks(rows, commands);
    const textBlock = blocks.find((b) => b.previewable && b.rows.some((r) => r.category === "text"));
    ok(textBlock);
    ok(textBlock!.rows.some((r) => r.category === "alignment"));
    ok(textBlock!.rows.some((r) => r.category === "style"));
    strictEqual(blocks.filter((b) => b.previewable).length, 1);
  });

  it("groups demo receipt into setup, preview, and QR composite", () => {
    const bytes = readFileSync(join(escposDir, "demo-receipt.bin"));
    const { commands, rows } = escposRows(bytes);
    const blocks = buildEscPosBlocks(rows, commands);
    const kinds = blocks.map((b) => b.kind);
    ok(kinds.includes("drawable") || kinds.includes("composite"));
    ok(blocks.some((b) => b.title === "QR Code" && b.kind === "composite"));
    ok(blocks.filter((b) => b.previewable).length >= 5);
  });

  it("folds per-line code page resets into text composites (USA POS style)", () => {
    const bytes = readFileSync(join(escposDir, "usa-pos-per-line-state.bin"));
    const { commands, rows } = escposRows(bytes);
    const blocks = buildEscPosBlocks(rows, commands);
    strictEqual(blocks.length < 40, true, `expected fewer blocks, got ${blocks.length}`);
    strictEqual(
      blocks.filter((b) => b.kind === "setup").length,
      1,
      "only leading initialize should remain as setup",
    );
    ok(blocks.some((b) => b.detail.includes("#0006")));
    ok(blocks.every((b) => b.kind !== "setup" || b.rows.every((r) => r.category === "initialize")));
  });

  it("collapses TSPL meta into setup blocks", () => {
    const bytes = readFileSync(join(here, "../tspl/demo-label.tspl"), "utf8");
    const { commands } = parseTspl(new TextEncoder().encode(bytes));
    const rows = commands.map((cmd, index) => ({
      commandId: `tspl-${index}`,
      index: index + 1,
      category: cmd.kind,
      label: cmd.kind.toUpperCase(),
      offset: cmd.span.offset,
      length: cmd.span.length,
      detail: cmd.kind,
      previewable: !["size", "gap", "cls", "print", "direction", "reference"].includes(cmd.kind),
    }));
    const blocks = buildTsplBlocks(rows, commands);
    ok(blocks.some((b) => b.kind === "setup" && b.rows.length >= 4));
    ok(blocks.filter((b) => b.previewable).length >= 5);
  });
});
