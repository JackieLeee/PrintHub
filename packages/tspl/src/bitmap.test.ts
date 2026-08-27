import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { tsplBitmapForPreview } from "./bitmap.js";

describe("tsplBitmapForPreview", () => {
  it("inverts mostly-black bitmaps", () => {
    const data = new Uint8Array(10).fill(0xff);
    const out = tsplBitmapForPreview(data);
    strictEqual(out[0], 0x00);
  });

  it("keeps mostly-white bitmaps unchanged", () => {
    const data = new Uint8Array(10).fill(0x00);
    const out = tsplBitmapForPreview(data);
    strictEqual(out[0], 0x00);
  });
});
