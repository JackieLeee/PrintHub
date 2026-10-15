import WebSocket from "ws";
import type { PrintJobMeta } from "@virt-printer/shared";

export const MAX_PAYLOAD = 20 * 1024 * 1024;
export class ControlError extends Error {
  constructor(public code: string, message: string, public exitCode = 1, public details?: unknown) { super(message); }
}
export interface CapturedJob { job: PrintJobMeta; payloadBase64: string; hubInstanceId: string }

/** A bounded live subscription, never a job history or durable acknowledgement. */
export class JobCapture {
  private ws: WebSocket;
  private jobs = new Map<string, CapturedJob>();
  private partial = new Map<string, { job: PrintJobMeta; chunks: Map<number, Buffer>; count: number; size: number }>();
  private bytes = 0;
  private failure?: Error;
  private instance = "";
  private target?: string;
  private resolveJob?: (job: CapturedJob) => void;
  private rejectJob?: (err: Error) => void;
  private resolveReady!: () => void;
  private rejectReady!: (err: Error) => void;
  readonly ready: Promise<void>;
  private abort: () => void;
  constructor(url: URL, private signal: AbortSignal, private expectedInstance?: string) {
    this.ready = new Promise((resolve, reject) => { this.resolveReady = resolve; this.rejectReady = reject; });
    // Attach before I/O to avoid unhandled rejection during an HTTP request.
    void this.ready.catch(() => {});
    this.ws = new WebSocket(url, { maxPayload: MAX_PAYLOAD * 2, handshakeTimeout: 10_000 });
    this.abort = () => this.fail(new ControlError("TIMEOUT", "Job observation cancelled or timed out"));
    signal.addEventListener("abort", this.abort, { once: true });
    this.ws.on("error", () => this.fail(new ControlError("CONNECTION_FAILED", "WebSocket connection failed")));
    this.ws.on("close", () => this.fail(new ControlError("CONNECTION_CLOSED", "WebSocket closed before capture completed")));
    this.ws.on("message", (raw) => {
      try { this.message(JSON.parse(raw.toString())); }
      catch (err) { this.fail(err instanceof Error ? err : new Error("invalid stream")); }
    });
    if (signal.aborted) this.abort();
  }
  private fail(err: Error) {
    if (this.failure) return;
    this.failure = err;
    this.rejectReady(err);
    this.rejectJob?.(err);
    this.close();
  }
  private metadata(job: PrintJobMeta) {
    if (!job || typeof job.id !== "string" || !Number.isSafeInteger(job.byteLength) || job.byteLength < 0 || job.byteLength > MAX_PAYLOAD) throw new ControlError("INVALID_STREAM", "Invalid job metadata");
  }
  private decode(value: unknown): Buffer {
    if (typeof value !== "string" || value.length > MAX_PAYLOAD * 1.4 || (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value))) throw new ControlError("INVALID_STREAM", "Invalid base64 payload");
    const result = Buffer.from(value, "base64");
    if (result.toString("base64") !== value) throw new ControlError("INVALID_STREAM", "Noncanonical base64 payload");
    this.bytes += result.length;
    if (this.bytes > MAX_PAYLOAD * 2) throw new ControlError("CAPTURE_LIMIT", "Capture buffer limit exceeded");
    return result;
  }
  private complete(job: PrintJobMeta, payload: Buffer) {
    if (payload.length !== job.byteLength) throw new ControlError("INVALID_STREAM", "Job byte length mismatch");
    const captured = { job, payloadBase64: payload.toString("base64"), hubInstanceId: this.instance };
    this.jobs.set(job.id, captured);
    if (this.jobs.size > 32) throw new ControlError("CAPTURE_LIMIT", "Too many unrelated jobs");
    if (this.resolveJob && (!this.target || job.id === this.target)) this.resolveJob(captured);
  }
  private message(msg: any) {
    if (msg.type === "hub.status") {
      const id = msg.status?.hubInstanceId;
      if (typeof id !== "string" || (this.instance && id !== this.instance) || (this.expectedInstance && id !== this.expectedInstance)) throw new ControlError("INSTANCE_CHANGED", "Hub instance changed");
      this.instance = id;
      this.resolveReady();
      return;
    }
    if (!this.instance) return;
    if (msg.type === "job.complete") {
      this.metadata(msg.job);
      this.complete(msg.job, this.decode(msg.payloadBase64));
    } else if (msg.type === "job.start") {
      this.metadata(msg.job);
      if (!Number.isSafeInteger(msg.chunkCount) || msg.chunkCount < 1 || msg.chunkCount > 4096 || !Number.isSafeInteger(msg.chunkSize) || msg.chunkSize < 1 || msg.chunkSize > MAX_PAYLOAD || Math.ceil(msg.job.byteLength / msg.chunkSize) !== msg.chunkCount || this.partial.has(msg.job.id)) throw new ControlError("INVALID_STREAM", "Invalid chunk header");
      this.partial.set(msg.job.id, { job: msg.job, chunks: new Map(), count: msg.chunkCount, size: msg.chunkSize });
      if (this.partial.size > 32) throw new ControlError("CAPTURE_LIMIT", "Too many incomplete jobs");
    } else if (msg.type === "job.chunk") {
      const entry = this.partial.get(msg.id);
      if (!entry || !Number.isInteger(msg.index) || msg.index < 0 || msg.index >= entry.count || entry.chunks.has(msg.index)) throw new ControlError("INVALID_STREAM", "Unexpected or duplicate chunk");
      const chunk = this.decode(msg.dataBase64);
      const expected = msg.index === entry.count - 1 ? entry.job.byteLength - entry.size * (entry.count - 1) : entry.size;
      if (chunk.length !== expected) throw new ControlError("INVALID_STREAM", "Chunk length mismatch");
      entry.chunks.set(msg.index, chunk);
    } else if (msg.type === "job.end") {
      const entry = this.partial.get(msg.id);
      if (!entry || entry.chunks.size !== entry.count) throw new ControlError("INVALID_STREAM", "Incomplete chunked job");
      this.partial.delete(msg.id);
      this.complete(entry.job, Buffer.concat(Array.from({ length: entry.count }, (_, i) => entry.chunks.get(i)!)));
    }
  }
  wait(jobId?: string): Promise<CapturedJob> {
    if (this.failure) return Promise.reject(this.failure);
    this.target = jobId;
    const existing = jobId ? this.jobs.get(jobId) : this.jobs.values().next().value;
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => { this.resolveJob = resolve; this.rejectJob = reject; });
  }
  close() {
    this.signal.removeEventListener("abort", this.abort);
    this.ws.terminate();
  }
}
