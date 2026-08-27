import { createServer, type Server, type Socket } from "node:net";
import { networkInterfaces, hostname } from "node:os";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { buildDleEotResponses, isMeaningfulPrintJob, prepareTcpPrintPayload } from "./job-filter.js";
import type {
  BridgeMessage,
  DeviceConnection,
  HubStatus,
  PrintJobMeta,
  Protocol,
  WsClientInfo,
} from "@virt-printer/shared";
import {
  DEFAULT_HTTP_PORT,
  DEFAULT_TCP_PORT,
  TCP_FLUSH_IDLE_MS,
  TCP_IDLE_TIMEOUT_MS,
  WS_PING_INTERVAL_MS,
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
  private tcpServer: Server | null = null;
  private wss: WebSocketServer | null = null;
  private httpServer: HttpServer | null = null;
  private connections = new Map<string, DeviceConnection>();
  private wsClients = new Map<string, { ws: WebSocket; info: WsClientInfo }>();
  private jobCounter = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private mdns: MdnsHandle | null = null;
  private webRoot: string | null = null;

  constructor(options: BridgeOptions = {}) {
    this.hubInstanceId = randomUUID();
    this.tcpPort = options.tcpPort ?? DEFAULT_TCP_PORT;
    this.httpPort = options.httpPort ?? DEFAULT_HTTP_PORT;
    // WebSocket shares the HTTP server port (unified UI + API + WS).
    this.wsPort = options.wsPort ?? this.httpPort;
    this.host = options.host ?? "0.0.0.0";
  }

  async start(): Promise<void> {
    await this.startTcp();
    this.webRoot = resolveWebRoot();
    this.httpServer = startHttpServer({
      port: this.httpPort,
      host: this.host,
      bridge: this,
      webRoot: this.webRoot,
    });
    await this.attachWebSocket(this.httpServer);
    this.startWsPing();
    this.mdns = startMdnsAdvertise({
      name: `virt-printer-${hostname()}`,
      hostIp: getLocalIp(),
      wsPort: this.wsPort,
      tcpPort: this.tcpPort,
      httpPort: this.httpPort,
    });
    this.broadcastStatus();
    const lan = getLocalIp();
    if (this.webRoot) {
      console.log(
        `[bridge] UI http://${lan}:${this.httpPort} · TCP ${this.tcpPort} · WS ${this.wsPort} (same port)`,
      );
    } else {
      console.log(
        `[bridge] TCP ${this.tcpPort} · HTTP ${this.httpPort} · WS ${this.wsPort} · LAN ${lan}`,
      );
      console.log("[bridge] Web UI not found — run: pnpm --filter @virt-printer/web build");
    }
  }

  async stop(): Promise<void> {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.mdns?.stop();
    this.mdns = null;
    for (const { ws } of this.wsClients.values()) ws.close();
    this.wsClients.clear();
    this.wss?.close();
    this.httpServer?.close();
    this.tcpServer?.close();
  }

  getPublicStatus(): HubStatus {
    return this.getStatus();
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
    this.broadcast({ type: "connection.open", connection });
    this.broadcastStatus();

    const chunks: Buffer[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flushTcpJob = () => {
      if (chunks.length === 0) return;
      const raw = Buffer.concat(chunks);
      const prepared = prepareTcpPrintPayload(raw);
      chunks.length = 0;
      if (!prepared) return;
      const payload = Buffer.from(prepared);
      const protocol = detectProtocol(payload);
      if (isMeaningfulPrintJob(prepared, protocol)) {
        this.emitJob(connection, payload, "tcp");
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

      // Reply to DLE EOT status polls so POS software stays connected
      for (const statusByte of buildDleEotResponses(chunk)) {
        socket.write(statusByte);
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
      this.connections.delete(sessionId);
      this.broadcast({ type: "connection.close", sessionId });
      this.broadcastStatus();
    });

    socket.on("error", () => {
      this.connections.delete(sessionId);
      this.broadcastStatus();
    });
  }

  private emitJob(
    connection: DeviceConnection,
    payload: Buffer,
    source: string,
  ): PrintJobMeta {
    const id = `job-${++this.jobCounter}-${Date.now()}`;
    const meta: PrintJobMeta = {
      id,
      protocol: detectProtocol(payload),
      sourceIp: connection.ip,
      sessionId: connection.sessionId,
      receivedAt: Date.now(),
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
    return {
      hubInstanceId: this.hubInstanceId,
      hostIp: getLocalIp(),
      tcpPort: this.tcpPort,
      wsPort: this.wsPort,
      httpPort: this.httpPort,
      listening: true,
      connections: [...this.connections.values()],
      wsClients: [...this.wsClients.values()].map((c) => c.info),
    };
  }

  private broadcastStatus(): void {
    this.broadcast({ type: "hub.status", status: this.getStatus() });
  }

  private broadcast(message: BridgeMessage): void {
    const data = JSON.stringify(message);
    for (const { ws } of this.wsClients.values()) {
      if (ws.readyState === ws.OPEN) ws.send(data);
    }
  }
}
