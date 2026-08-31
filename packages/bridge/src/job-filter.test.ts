import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
  buildDleEotResponses,
  isMeaningfulPrintJob,
  prepareTcpPrintPayload,
  trimTrailingStatusPolls,
} from "./job-filter.js";

describe("job-filter", () => {
  it("trims trailing DLE EOT and GS V heartbeat after print bytes", () => {
    const print = new Uint8Array([0x48, 0x69, 0x0a]);
    const heartbeat = Uint8Array.from(atob("ChAEAR1WQkIQBAEQBAE="), (c) => c.charCodeAt(0));
    const combined = new Uint8Array(print.length + heartbeat.length);
    combined.set(print);
    combined.set(heartbeat, print.length);

    const trimmed = trimTrailingStatusPolls(combined);
    strictEqual(trimmed.length, print.length + 1);
    strictEqual(trimmed[0], 0x48);
    strictEqual(trimmed[trimmed.length - 1], 0x0a);
  });

  it("responds to ENQ with ACK", () => {
    const enq = new Uint8Array([0x05]);
    const responses = buildDleEotResponses(enq);
    strictEqual(responses.length, 1);
    strictEqual(responses[0]![0], 0x06);
  });

  it("prepareTcpPrintPayload drops heartbeat-only packets", () => {
    const heartbeat = Uint8Array.from(atob("HVZCQhAEARAEAQ=="), (c) => c.charCodeAt(0));
    strictEqual(prepareTcpPrintPayload(heartbeat), null);
    strictEqual(isMeaningfulPrintJob(heartbeat, "escpos"), false);
  });

  it("treats cash-drawer-only ESC p as non-print job", () => {
    const drawerOnly = new Uint8Array([0x1b, 0x70, 0x00, 0x3c, 0xff]);
    strictEqual(isMeaningfulPrintJob(drawerOnly, "escpos"), false);
  });

  it("keeps receipt with trailing cash drawer in print history", () => {
    const receiptWithDrawer = new Uint8Array([
      0x48,
      0x69,
      0x0a,
      0x1b,
      0x70,
      0x00,
      0x19,
      0xfa,
    ]);
    strictEqual(isMeaningfulPrintJob(receiptWithDrawer, "escpos"), true);
  });
});
