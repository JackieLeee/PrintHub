import type { BridgeMessage, PrintJobMeta } from "@virt-printer/shared";
import type { RelayClientHandlers } from "@virt-printer/relay-client";

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Desktop IPC transport — same handler surface as RelayClient. */
export class DesktopRelayClient {
  private handlers: RelayClientHandlers;
  private pending = new Map<string, PendingJob>();
  private unsubscribe: (() => void) | null = null;
  private connected = false;

  constructor(handlers: RelayClientHandlers = {}) {
    this.handlers = handlers;
  }

  connect(): void {
    const api = window.printhubDesktop;
    if (!api) {
      this.handlers.onError?.(new Event("desktop-api-missing"));
      return;
    }

    this.unsubscribe?.();
    this.unsubscribe = api.onBridgeMessage((message) => {
      this.handlers.onMessage?.(message);
      this.dispatch(message);
    });

    void this.connectWithRetry(api, 0);
  }

  private async connectWithRetry(
    api: NonNullable<typeof window.printhubDesktop>,
    attempt: number,
  ): Promise<void> {
    const ok = await api.connect();
    if (!ok) {
      if (attempt < 8) {
        await sleep(250);
        return this.connectWithRetry(api, attempt + 1);
      }
      this.connected = false;
      this.handlers.onError?.(new Event("desktop-connect-failed"));
      return;
    }

    this.connected = true;
    this.handlers.onOpen?.();
    const status = await api.getBridgeStatus();
    if (status) this.handlers.onStatus?.(status);
  }

  private dispatch(msg: BridgeMessage): void {
    if (msg.type === "hub.status") {
      this.handlers.onStatus?.(msg.status);
      return;
    }

    if (
      msg.type === "connection.open" ||
      msg.type === "connection.close" ||
      msg.type === "ws.open" ||
      msg.type === "ws.close"
    ) {
      void window.printhubDesktop?.getBridgeStatus().then((next) => {
        if (next) this.handlers.onStatus?.(next);
      });
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
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.pending.clear();
    if (this.connected) {
      void window.printhubDesktop?.disconnect();
    }
    this.connected = false;
    this.handlers.onClose?.();
  }

  get connectedState(): boolean {
    return this.connected;
  }
}
