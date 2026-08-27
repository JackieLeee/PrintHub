import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { isBlankBitmap, payloadHasRaster } from "./raster-detect.js";

describe("raster-detect", () => {
  it("isBlankBitmap treats all-zero buffers as blank", () => {
    strictEqual(isBlankBitmap(new Uint8Array(64)), true);
    strictEqual(isBlankBitmap(new Uint8Array([0, 0, 1])), false);
  });

  it("payloadHasRaster detects ESC * and GS v 0", () => {
    const escStar = new Uint8Array([0x1b, 0x2a, 0x21, 0x40, 0x02, 0x00]);
    strictEqual(payloadHasRaster(escStar), true);

    const gsV0 = new Uint8Array([0x1d, 0x76, 0x30, 0x00, 0x01, 0x00, 0x08, 0x00]);
    strictEqual(payloadHasRaster(gsV0), true);

    const textOnly = new Uint8Array([0x1b, 0x40, 0x48, 0x69, 0x0a]);
    strictEqual(payloadHasRaster(textOnly), false);
  });
});
