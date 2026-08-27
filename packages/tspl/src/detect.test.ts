import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { isTsplPayload } from "./detect.js";

describe("isTsplPayload", () => {
  it("detects SIZE command after ESC init", () => {
    const payload = new Uint8Array([
      0x1b, 0x40,
      ...new TextEncoder().encode("SIZE 40.0 mm,60.0 mm\r\nCLS\r\n"),
    ]);
    strictEqual(isTsplPayload(payload), true);
  });

  it("returns false for plain ESC/POS receipt", () => {
    const payload = new TextEncoder().encode("Hello receipt\n\x1b\x40");
    strictEqual(isTsplPayload(payload), false);
  });

  it("returns false when receipt text contains Print test (not TSPL PRINT cmd)", () => {
    const payload = new Uint8Array([
      0x1b, 0x40, 0x1b, 0x61, 0x00,
      ...new TextEncoder().encode("                 Print test                 \n"),
    ]);
    strictEqual(isTsplPayload(payload), false);
  });

  it("detects PRINT 1 as TSPL", () => {
    const payload = new TextEncoder().encode("SIZE 40 mm,30 mm\nCLS\nPRINT 1\n");
    strictEqual(isTsplPayload(payload), true);
  });

  it("detects SIZE at payload start", () => {
    const payload = new TextEncoder().encode("SIZE 40.0 mm,60.0 mm\r\nCLS\r\n");
    strictEqual(isTsplPayload(payload), true);
  });
});
