import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { detectEscPosDialect } from "./dialect.js";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "../../fixtures/escpos");

describe("detectEscPosDialect", () => {
  it("detects Star column-bitmap receipts", () => {
    const payload = readFileSync(join(fixturesRoot, "star-image-receipt.bin"));
    strictEqual(detectEscPosDialect(payload), "star");
  });

  it("leaves Epson GS v0 receipts as standard", () => {
    const payload = readFileSync(join(fixturesRoot, "raster-logo-cut.bin"));
    strictEqual(detectEscPosDialect(payload), "standard");
  });

  it("leaves UTF-8 restaurant receipts as standard", () => {
    const payload = readFileSync(join(fixturesRoot, "restaurant-utf8.bin"));
    strictEqual(detectEscPosDialect(payload), "standard");
  });
});
