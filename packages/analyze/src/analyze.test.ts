import { strictEqual, ok } from "node:assert";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { analyzePrintPayload, ANALYZE_SCHEMA_VERSION } from "./analyze.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../fixtures/escpos");

describe("analyzePrintPayload", () => {
  it("returns JSON-serializable ESC/POS analysis", () => {
    const bytes = readFileSync(join(fixturesDir, "demo-receipt.bin"));
    const result = analyzePrintPayload(bytes);
    strictEqual(result.schemaVersion, ANALYZE_SCHEMA_VERSION);
    strictEqual(result.protocol, "escpos");
    ok(result.commandCount >= 8);
    ok(result.blocks.length > 0);
    ok(result.summary.hasText);
    strictEqual(typeof JSON.stringify(result), "string");
  });

  it("detects TSPL payloads", () => {
    const bytes = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../fixtures/tspl/demo-label.tspl"),
      "utf8",
    );
    const result = analyzePrintPayload(new TextEncoder().encode(bytes));
    strictEqual(result.protocol, "tspl");
    ok(result.summary.hasText);
  });
});
