import type { BridgeMessage, PrintJobMeta } from "@virt-printer/shared";
import { JOB_CHUNK_SIZE, JOB_CHUNK_THRESHOLD } from "@virt-printer/shared";

export function chunkCount(byteLength: number): number {
  if (byteLength <= JOB_CHUNK_THRESHOLD) return 1;
  return Math.ceil(byteLength / JOB_CHUNK_SIZE);
}

export function sliceChunk(payload: Buffer, index: number): Buffer {
  const start = index * JOB_CHUNK_SIZE;
  return payload.subarray(start, start + JOB_CHUNK_SIZE);
}

export type JobBroadcast = Extract<
  BridgeMessage,
  { type: "job.complete" } | { type: "job.start" } | { type: "job.chunk" } | { type: "job.end" }
>;

/** Build ordered messages for delivering a print job to WebSocket clients. */
export function buildJobMessages(meta: PrintJobMeta, payload: Buffer): JobBroadcast[] {
  if (payload.length <= JOB_CHUNK_THRESHOLD) {
    return [{ type: "job.complete", job: meta, payloadBase64: payload.toString("base64") }];
  }

  const total = chunkCount(payload.length);
  const messages: JobBroadcast[] = [
    { type: "job.start", job: meta, chunkCount: total, chunkSize: JOB_CHUNK_SIZE },
  ];
  for (let i = 0; i < total; i++) {
    messages.push({
      type: "job.chunk",
      id: meta.id,
      index: i,
      dataBase64: sliceChunk(payload, i).toString("base64"),
    });
  }
  messages.push({ type: "job.end", id: meta.id });
  return messages;
}
