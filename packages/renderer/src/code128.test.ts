import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { code128WidthDots, encodeCode128B } from "./code128.js";

describe("code128", () => {
  it("encodes payload with start, checksum, and stop", () => {
    const codes = encodeCode128B("0123456789");
    strictEqual(codes[0], 104);
    strictEqual(codes[codes.length - 1], 106);
    strictEqual(codes.length, 13);
  });

  it("estimates width from module count", () => {
    const w = code128WidthDots("0123456789", 3);
    strictEqual(w > 400, true);
    strictEqual(w < 900, true);
  });
});
