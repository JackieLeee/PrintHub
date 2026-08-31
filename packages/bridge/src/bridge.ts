import { createServer, type Server, type Socket } from "node:net";
import { networkInterfaces, hostname } from "node:os";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { buildDleEotResponses, isMeaningfulPrintJob, prepareTcpPrintPayload } from "./job-filter.js";
import { PrinterSimState } from "./printer-sim.js";
import type {
  BridgeMessage,
  DeviceConnection,
  HubStatus,
  PrintJobMeta,
  PrinterSimConfig,
  PrinterSimEvent,
  Protocol,
  WsClientInfo,
} from "@virt-printer/shared";
import {
  DEFAULT_HTTP_PORT,
  DEFAULT_TCP_PORT,
  TCP_FLUSH_IDLE_MS,
  TCP_IDLE_TIMEOUT_MS,
  WS_PING_INTERVAL_MS,
  computeSimLiveState,
  type TcpQueueEntry,
} from "@virt-printer/shared";
import { formatLabelSize, isTsplPayload, parseTspl } from "@virt-printer/tspl";
import { buildJobMessages } from "./chunking.js";
import { startHttpServer } from "./http-server.js";
import { imageBufferToPrintPayload, type ImagePrintOptions } from "./image-print.js";
import { startMdnsAdvertise, type MdnsHandle } from "./mdns.js";
import { resolveWebRoot } from "./web-static.js";

export interface BridgeOptions {
  tcpPort?: number;
  wsPort?: number;
  httpPort?: number;
  host?: string;
  /** When false, only TCP listens (e.g. desktop IPC). Defaults to true. */
  enableHttp?: boolean;
  /** Serve embedded Web UI on HTTP when HTTP is enabled. Defaults to true. */
  serveStaticUi?: boolean;
}

function getLocalIp(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "127.0.0.1";
}

function detectProtocol(payload: Buffer): Protocol {
  return isTsplPayload(payload) ? "tspl" : "escpos";
}

function labelSizeFromPayload(payload: Buffer): string | undefined {
  if (!isTsplPayload(payload)) return undefined;
  return formatLabelSize(parseTspl(payload).commands) ?? undefined;
}

function wsClientIp(req: IncomingMessage): string {
  return req.socket.remoteAddress?.replace("::ffff:", "") ?? "unknown";
}

export class VirtPrinterBridge {
  readonly hubInstanceId: string;
  private tcpPort: number;
  private wsPort: number;
  private httpPort: number;
  private host: string;
  private enableHttp: boolean;
  private serveStaticUi: boolean;
  private tcpServer: Server | null = null;
  private wss: WebSocketServer | null = null;
  private httpServer: HttpServer | null = null;
  private connections = new Map<string, DeviceConnection>();
  private wsClients = new Map<string, { ws: WebSocket; info: WsClientInfo }>();
  private messageListeners = new Set<(message: BridgeMessage) => void>();
  private jobCounter = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private mdns: MdnsHandle | null = null;
  private mdnsPrinter = false;
  private webRoot: string | null = null;
  private printerSim = new PrinterSimState();
  private tcpQueues = new Map<string, TcpQueueEntry>();
  private tcpSockets = new Map<string, Socket>();

  private disconnectAllTcpClients(): void {
    for (const [sessionId, socket] of this.tcpSockets) {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      this.tcpSockets.delete(sessionId);
      this.connections.delete(sessionId);
      this.clearTcpQueue(sessionId);
      this.broadcast({ type: "connection.close", sessionId });
    }
    this.broadcastStatus();
  }

  private setTcpQueue(sessionId: string, sourceIp: string, patch: Partial<TcpQueueEntry>): void {
    const prev = this.tcpQueues.get(sessionId) ?? {
      sessionId,
      sourceIp,
      state: "receiving" as const,
      bufferedBytes: 0,
    };
    this.tcpQueues.set(sessionId, { ...prev, ...patch, sessionId, sourceIp });
  }

  private clearTcpQueue(sessionId: string): void {
    this.tcpQueues.delete(sessionId);
  }

  private queueDepth(): number {
    let depth = 0;
    for (const entry of this.tcpQueues.values()) {
      if (entry.state === "queued" || entry.state === "processing") depth += 1;
    }
    return depth;
  }

  constructor(options: BridgeOptions = {}) {
    this.hubInstanceId = randomUUID();
    this.tcpPort = options.tcpPort ?? DEFAULT_TCP_PORT;
    this.httpPort = options.httpPort ?? DEFAULT_HTTP_PORT;
    this.enableHttp = options.enableHttp ?? true;
    this.serveStaticUi = options.serveStaticUi ?? true;
    // WebSocket shares the HTTP server port (unified UI + API + WS).
    this.wsPort = options.wsPort ?? this.httpPort;
    this.host = options.host ?? "0.0.0.0";
  }

  /** Subscribe to bridge events (for Electron IPC). Returns an unsubscribe function. */
  subscribe(listener: (message: BridgeMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  async start(): Promise<void> {
    await this.startTcp();
    const lan = getLocalIp();

    if (this.enableHttp) {
      this.webRoot = this.serveStaticUi ? resolveWebRoot() : null;
      this.httpServer = startHttpServer({
        port: this.httpPort,
        host: this.host,
        bridge: this,
        webRoot: this.webRoot,
      });
      await this.attachWebSocket(this.httpServer);
      this.startWsPing();
      if (this.webRoot) {
        console.log(
          `[bridge] UI http://${lan}:${this.httpPort} · TCP ${this.tcpPort} · WS ${this.wsPort} (same port)`,
        );
      } else {
        console.log(
          `[bridge] LAN API http://${lan}:${this.httpPort} · TCP ${this.tcpPort} · WS ${this.wsPort}`,
        );
      }
    } else {
      this.webRoot = null;
      console.log(`[bridge] TCP ${this.tcpPort} · LAN ${lan} (HTTP/WS disabled)`);
    }

    try {
      this.mdns = startMdnsAdvertise({
        name: `PrintHub-${hostname()}`,
        hostIp: lan,
        wsPort: this.enableHttp ? this.wsPort : 0,
        tcpPort: this.tcpPort,
        httpPort: this.enableHttp ? this.httpPort : 0,
      });
      this.mdnsPrinter = true;
    } catch (err) {
      this.mdnsPrinter = false;
      console.warn("[bridge] mDNS start failed:", err);
    }

    this.broadcastStatus();
  }

  async stop(): Promise<void> {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.mdns?.stop();
    this.mdns = null;
    this.mdnsPrinter = false;
    for (const { ws } of this.wsClients.values()) ws.close();
    this.wsClients.clear();
    this.wss?.close();
    this.httpServer?.close();
    this.tcpServer?.close();
  }

  getPublicStatus(): HubStatus {
    return this.getStatus();
  }

  getPrinterSimConfig(): PrinterSimConfig {
    return this.printerSim.getConfig();
  }

  setPrinterSimConfig(partial: Partial<PrinterSimConfig>, sourceIp?: string): PrinterSimConfig {
    const config = this.printerSim.setConfig(partial, sourceIp);
    if (this.printerSim.isOffline()) {
      this.disconnectAllTcpClients();
    }
    this.broadcastStatus();
    return config;
  }

  clearSimEvents(): void {
    this.printerSim.clearEvents();
    this.broadcastStatus();
  }

  kickCashDrawer(pin = 0, sourceIp = "127.0.0.1"): PrinterSimEvent | null {
    const event = this.printerSim.recordCashDrawer(sourceIp, pin, 60, 120, true);
    if (event) this.broadcast({ type: "sim.event", event });
    return event;
  }

  async ingestImage(
    image: Buffer,
    opts: ImagePrintOptions & { sourceIp: string },
  ): Promise<PrintJobMeta> {
    const payload = await imageBufferToPrintPayload(image, opts);
    const connection: DeviceConnection = {
      sessionId: `http-${randomUUID()}`,
      ip: opts.sourceIp,
      port: 0,
      protocol: opts.protocol,
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
      label: `HTTP ${opts.sourceIp}`,
    };
    return this.emitJob(connection, payload, "image");
  }

  ingestRaw(payload: Buffer, sourceIp: string): PrintJobMeta {
    const protocol = detectProtocol(payload);
    const connection: DeviceConnection = {
      sessionId: `http-${randomUUID()}`,
      ip: sourceIp,
      port: 0,
      protocol,
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
      label: `HTTP ${sourceIp}`,
    };
    this.printerSim.scanPayloadForDrawer(payload, sourceIp).forEach((event) => {
      this.broadcast({ type: "sim.event", event });
    });
    if (this.printerSim.shouldRejectPrint()) {
      const rejected = this.printerSim.recordJobRejected(sourceIp, payload.length);
      if (rejected) this.broadcast({ type: "sim.event", event: rejected });
      throw new Error("print rejected by printer simulation");
    }
    if (!isMeaningfulPrintJob(payload, protocol)) {
      throw new Error("payload has no printable content");
    }
    return this.emitJob(connection, payload, "raw");
  }

  private startWsPing(): void {
    this.pingTimer = setInterval(() => {
      for (const { ws } of this.wsClients.values()) {
        if (ws.readyState === ws.OPEN) ws.ping();
      }
    }, WS_PING_INTERVAL_MS);
  }

  private startTcp(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.tcpServer = createServer((socket) => this.handleTcpConnection(socket));
      this.tcpServer.on("error", reject);
      this.tcpServer.listen(this.tcpPort, this.host, () => resolve());
    });
  }

  private attachWebSocket(server: HttpServer): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ server });
      this.wss.on("connection", (ws, req) => {
        // Drop dead / duplicate WebSocket clients (StrictMode, HMR, stale tabs)
        for (const [id, client] of this.wsClients) {
          if (client.ws.readyState === WebSocket.CLOSED || client.ws.readyState === WebSocket.CLOSING) {
            this.wsClients.delete(id);
          }
        }

        const sessionId = randomUUID();
        const ip = wsClientIp(req);
        const info: WsClientInfo = {
          sessionId,
          ip,
          connectedAt: Date.now(),
          lastActivityAt: Date.now(),
        };
        this.wsClients.set(sessionId, { ws, info });
        ws.send(JSON.stringify({ type: "hub.status", status: this.getStatus() } satisfies BridgeMessage));
        this.broadcast({ type: "ws.open", client: info });
        this.broadcastStatus();

        ws.on("pong", () => {
          info.lastActivityAt = Date.now();
        });

        ws.on("error", () => {
          this.wsClients.delete(sessionId);
          this.broadcastStatus();
        });

        ws.on("close", () => {
          this.wsClients.delete(sessionId);
          this.broadcast({ type: "ws.close", sessionId });
          this.broadcastStatus();
        });
      });
      resolve();
    });
  }

  private handleTcpConnection(socket: Socket): void {
    if (this.printerSim.isOffline()) {
      socket.destroy();
      return;
    }

    const sessionId = randomUUID();
    const remoteIp = socket.remoteAddress?.replace("::ffff:", "") ?? "unknown";
    const now = Date.now();
    const connection: DeviceConnection = {
      sessionId,
      ip: remoteIp,
      port: socket.remotePort ?? 0,
      protocol: "escpos",
      connectedAt: now,
      lastActivityAt: now,
      label: `TCP ${remoteIp}`,
    };

    socket.setKeepAlive(true, 30_000);
    socket.setTimeout(TCP_IDLE_TIMEOUT_MS);

    this.connections.set(sessionId, connection);
    this.tcpSockets.set(sessionId, socket);
    this.broadcast({ type: "connection.open", connection });
    this.broadcastStatus();

    const chunks: Buffer[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const jobQueue: Array<{ payload: Buffer; receivedAt: number }> = [];
    let processing = false;

    const drainJobQueue = () => {
      if (processing || jobQueue.length === 0) return;
      processing = true;
      const item = jobQueue.shift()!;
      this.setTcpQueue(sessionId, remoteIp, {
        state: "processing",
        bufferedBytes: item.payload.length,
      });
      this.broadcastStatus();

      const run = () => {
        const processedAt = Date.now();
        const durationMs = processedAt - item.receivedAt;
        const meta = this.emitJob(connection, item.payload, "tcp", {
          receivedAt: item.receivedAt,
          processedAt,
        });
        let ackMs: number | undefined;
        if (!this.printerSim.isOffline()) {
          const ackStart = Date.now();
          try {
            socket.write(Buffer.from([0x06]));
            ackMs = Date.now() - ackStart;
          } catch {
            /* socket may already be closed */
          }
        }
        const completed = this.printerSim.recordJobCompleted(
          remoteIp,
          item.payload.length,
          durationMs,
          ackMs,
        );
        if (completed) this.broadcast({ type: "sim.event", event: completed });
        void meta;

        processing = false;
        if (jobQueue.length > 0) {
          this.setTcpQueue(sessionId, remoteIp, { state: "queued", bufferedBytes: 0 });
        } else {
          this.clearTcpQueue(sessionId);
        }
        this.broadcastStatus();
        drainJobQueue();
      };

      const delay = this.printerSim.printDelayMs();
      if (delay > 0) setTimeout(run, delay);
      else run();
    };

    const flushTcpJob = () => {
      if (chunks.length === 0) return;
      const raw = Buffer.concat(chunks);
      const prepared = prepareTcpPrintPayload(raw);
      chunks.length = 0;
      if (!prepared) {
        this.clearTcpQueue(sessionId);
        this.broadcastStatus();
        return;
      }
      const payload = Buffer.from(prepared);
      const protocol = detectProtocol(payload);
      this.printerSim.scanPayloadForDrawer(prepared, remoteIp).forEach((event) => {
        this.broadcast({ type: "sim.event", event });
      });
      if (this.printerSim.shouldRejectPrint()) {
        const rejected = this.printerSim.recordJobRejected(remoteIp, prepared.length);
        if (rejected) this.broadcast({ type: "sim.event", event: rejected });
        this.clearTcpQueue(sessionId);
        this.broadcastStatus();
        return;
      }
      if (isMeaningfulPrintJob(prepared, protocol)) {
        jobQueue.push({ payload, receivedAt: Date.now() });
        this.setTcpQueue(sessionId, remoteIp, {
          state: jobQueue.length > 1 || processing ? "queued" : "processing",
          bufferedBytes: 0,
        });
        this.broadcastStatus();
        drainJobQueue();
      }
    };

    const scheduleFlush = () => {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flushTcpJob();
      }, TCP_FLUSH_IDLE_MS);
    };

    const touch = () => {
      connection.lastActivityAt = Date.now();
      socket.setTimeout(TCP_IDLE_TIMEOUT_MS);
    };

    socket.on("data", (chunk: Buffer) => {
      touch();
      chunks.push(chunk);
      connection.protocol = detectProtocol(Buffer.concat(chunks));
      this.setTcpQueue(sessionId, remoteIp, {
        state: processing ? "processing" : "receiving",
        bufferedBytes: Buffer.concat(chunks).length,
      });

      const simConfig = this.printerSim.getConfig();
      const responses = buildDleEotResponses(chunk, simConfig);
      if (responses.length > 0 && !this.printerSim.isOffline()) {
        const delay = this.printerSim.statusDelayMs();
        const writeResponses = () => {
          for (let i = 0; i + 2 < chunk.length; i++) {
            if (chunk[i] === 0x10 && chunk[i + 1] === 0x04 && chunk[i + 2]! >= 1 && chunk[i + 2]! <= 4) {
              const ev = this.printerSim.recordStatusPoll(remoteIp, chunk[i + 2]!);
              if (ev) this.broadcast({ type: "sim.event", event: ev });
            }
          }
          for (const statusByte of responses) {
            socket.write(statusByte);
          }
        };
        if (delay > 0) setTimeout(writeResponses, delay);
        else writeResponses();
      }

      scheduleFlush();
    });

    socket.on("timeout", () => {
      console.log(`[bridge] TCP idle timeout ${remoteIp}`);
      if (flushTimer) clearTimeout(flushTimer);
      flushTcpJob();
      socket.destroy();
    });

    socket.on("close", () => {
      if (flushTimer) clearTimeout(flushTimer);
      flushTcpJob();
      const leftover = Buffer.concat(chunks);
      if (leftover.length > 0) {
        console.log(`[bridge] ignored status/heartbeat from ${remoteIp} (${leftover.length} bytes)`);
      }
      this.tcpSockets.delete(sessionId);
      this.clearTcpQueue(sessionId);
      this.connections.delete(sessionId);
      this.broadcast({ type: "connection.close", sessionId });
      this.broadcastStatus();
    });

    socket.on("error", () => {
      this.tcpSockets.delete(sessionId);
      this.connections.delete(sessionId);
      this.broadcastStatus();
    });
  }

  private emitJob(
    connection: DeviceConnection,
    payload: Buffer,
    source: string,
    timing?: { receivedAt?: number; processedAt?: number },
  ): PrintJobMeta {
    const receivedAt = timing?.receivedAt ?? Date.now();
    const processedAt = timing?.processedAt ?? receivedAt;
    const id = `job-${++this.jobCounter}-${Date.now()}`;
    const meta: PrintJobMeta = {
      id,
      protocol: detectProtocol(payload),
      sourceIp: connection.ip,
      sessionId: connection.sessionId,
      receivedAt,
      processedAt,
      durationMs: processedAt - receivedAt,
      byteLength: payload.length,
      widthMm: connection.protocol === "escpos" ? 58 : undefined,
      labelSize: labelSizeFromPayload(payload),
      source,
    };

    for (const msg of buildJobMessages(meta, payload)) {
      this.broadcast(msg);
    }

    console.log(
      `[bridge] job ${id} from ${connection.ip} (${meta.protocol}, ${payload.length} bytes, ${source})`,
    );
    return meta;
  }

  private getStatus(): HubStatus {
    const scenario = this.printerSim.getConfig().scenario;
    const depth = this.queueDepth();
    return {
      hubInstanceId: this.hubInstanceId,
      hostIp: getLocalIp(),
      tcpPort: this.tcpPort,
      wsPort: this.enableHttp ? this.wsPort : 0,
      httpPort: this.enableHttp ? this.httpPort : 0,
      listening: true,
      connections: [...this.connections.values()],
      wsClients: [...this.wsClients.values()].map((c) => c.info),
      printerSim: this.printerSim.getConfig(),
      simEvents: this.printerSim.getEvents(),
      simLiveState: computeSimLiveState(scenario, depth),
      tcpQueue: [...this.tcpQueues.values()],
      mdnsPrinter: this.mdnsPrinter,
    };
  }

  private broadcastStatus(): void {
    this.broadcast({ type: "hub.status", status: this.getStatus() });
  }

  private broadcast(message: BridgeMessage): void {
    for (const listener of this.messageListeners) {
      try {
        listener(message);
      } catch (err) {
        console.warn("[bridge] message listener error:", err);
      }
    }
    const data = JSON.stringify(message);
    for (const { ws } of this.wsClients.values()) {
      if (ws.readyState === ws.OPEN) ws.send(data);
    }
  }
}
