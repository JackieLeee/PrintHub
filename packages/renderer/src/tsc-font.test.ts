import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { getTscFontMetrics, tscCharAdvance, tscTextWidthDots } from "./tsc-font.js";

describe("tsc-font", () => {
  it("resolves TSS24.BF2 to 12×24 dot cells", () => {
    const m = getTscFontMetrics("TSS24.BF2");
    strictEqual(m.cellW, 12);
    strictEqual(m.cellH, 24);
  });

  it("measures fixed-width spacing for padded label lines", () => {
    const line = "#1001 1/1              Pickup";
    const w = tscTextWidthDots(line, "TSS24.BF2", 1);
    strictEqual(w, line.length * 12);
    strictEqual(w < 378, true);
  });

  it("yMul does not widen characters", () => {
    strictEqual(tscCharAdvance("A", 12, 1), 12);
    strictEqual(tscCharAdvance("A", 12, 2), 24);
  });
});
