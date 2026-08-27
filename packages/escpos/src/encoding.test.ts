import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { decodeCp437, decodeCp850 } from "./cp437.js";
import { decodeTextBytes } from "./encoding.js";

describe("cp437", () => {
  it("decodes IBM box-drawing and Latin-1 extensions", () => {
    strictEqual(decodeCp437(new Uint8Array([0xe1])), "ß");
    strictEqual(decodeCp437(new Uint8Array([0x8e])), "Ä");
  });

  it("decodes cp437 via decodeTextBytes when ESC t 0 is active", () => {
    const text = decodeTextBytes(new Uint8Array([0xe1]), false, "cp437");
    strictEqual(text, "ß");
  });

  it("falls back cp850 decoder for high bytes", () => {
    const decoded = decodeCp850(new Uint8Array([0xc7, 0x65]));
    strictEqual(decoded.includes("e"), true);
  });
});
