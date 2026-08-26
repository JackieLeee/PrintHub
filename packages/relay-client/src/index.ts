import type { BridgeMessage, HubStatus, PrintJobMeta } from "@virt-printer/shared";

export type RelayClientHandlers = {
  onStatus?: (status: HubStatus) => void;
  onJob?: (meta: PrintJobMeta, payload: Uint8Array) => void;
  onMessage?: (message: BridgeMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
};

interface PendingJob {
  meta: PrintJobMeta;
  chunks: (Uint8Array | null)[];
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export class RelayClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: RelayClientHandlers;
  private pending = new Map<string, PendingJob>();

  constructor(url: string, handlers: RelayClientHandlers = {}) {
    this.url = url;
    this.handlers = handlers;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.ws = new WebSocket(this.url);
    this.pending.clear();

    this.ws.addEventListener("open", () => this.handlers.onOpen?.());
    this.ws.addEventListener("close", () => {
      this.pending.clear();
      this.handlers.onClose?.();
    });
    this.ws.addEventListener("error", (e) => this.handlers.onError?.(e));

    this.ws.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const msg = JSON.parse(event.data) as BridgeMessage;
      this.handlers.onMessage?.(msg);
      this.dispatch(msg);
    });
  }

  private dispatch(msg: BridgeMessage): void {
    if (msg.type === "hub.status") {
      this.handlers.onStatus?.(msg.status);
      return;
    }

    if (msg.type === "job.complete") {
      this.handlers.onJob?.(msg.job, base64ToBytes(msg.payloadBase64));
      return;
    }

    if (msg.type === "job.start") {
      this.pending.set(msg.job.id, {
        meta: msg.job,
        chunks: new Array(msg.chunkCount).fill(null),
      });
      return;
    }

    if (msg.type === "job.chunk") {
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      entry.chunks[msg.index] = base64ToBytes(msg.dataBase64);
      return;
    }

    if (msg.type === "job.end") {
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      this.pending.delete(msg.id);
      if (entry.chunks.some((c) => c === null)) return;
      const total = entry.chunks.reduce((n, c) => n + (c?.length ?? 0), 0);
      const payload = new Uint8Array(total);
      let offset = 0;
      for (const chunk of entry.chunks) {
        if (!chunk) continue;
        payload.set(chunk, offset);
        offset += chunk.length;
      }
      this.handlers.onJob?.(entry.meta, payload);
    }
  }

  disconnect(): void {
    const ws = this.ws;
    this.ws = null;
    this.pending.clear();
    if (!ws) return;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    if (ws.readyState === WebSocket.CONNECTING) {
      ws.addEventListener("open", () => ws.close(), { once: true });
      return;
    }
    if (ws.readyState === WebSocket.OPEN) ws.close();
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
