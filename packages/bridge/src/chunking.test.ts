import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { buildJobMessages, chunkCount } from "./chunking.js";
import { JOB_CHUNK_SIZE, JOB_CHUNK_THRESHOLD } from "@virt-printer/shared";

describe("buildJobMessages", () => {
  const meta = {
    id: "job-1",
    protocol: "escpos" as const,
    sourceIp: "127.0.0.1",
    sessionId: "s1",
    receivedAt: Date.now(),
    byteLength: 0,
  };

  it("uses job.complete for small payloads", () => {
    const payload = Buffer.from("hello");
    meta.byteLength = payload.length;
    const msgs = buildJobMessages(meta, payload);
    strictEqual(msgs.length, 1);
    strictEqual(msgs[0]!.type, "job.complete");
  });

  it("chunks large payloads", () => {
    const payload = Buffer.alloc(JOB_CHUNK_THRESHOLD + 1, 0xab);
    meta.byteLength = payload.length;
    const msgs = buildJobMessages(meta, payload);
    const expected = chunkCount(payload.length);
    strictEqual(msgs[0]!.type, "job.start");
    strictEqual(msgs.filter((m) => m.type === "job.chunk").length, expected);
    strictEqual(msgs[msgs.length - 1]!.type, "job.end");
    if (msgs[0]!.type === "job.start") {
      strictEqual(msgs[0].chunkSize, JOB_CHUNK_SIZE);
    }
  });

  it("reassembles chunk data length", () => {
    const payload = Buffer.alloc(JOB_CHUNK_THRESHOLD + JOB_CHUNK_SIZE, 0xcd);
    meta.byteLength = payload.length;
    const msgs = buildJobMessages(meta, payload);
    const chunks = msgs.filter((m) => m.type === "job.chunk");
    let total = 0;
    for (const c of chunks) {
      if (c.type === "job.chunk") total += Buffer.from(c.dataBase64, "base64").length;
    }
    strictEqual(total, payload.length);
  });
});
