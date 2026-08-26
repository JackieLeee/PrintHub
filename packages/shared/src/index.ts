export type Protocol = "escpos" | "tspl";

export interface DeviceConnection {
  sessionId: string;
  ip: string;
  port: number;
  protocol: Protocol;
  connectedAt: number;
  lastActivityAt: number;
  label: string;
}

export interface WsClientInfo {
  sessionId: string;
  ip: string;
  connectedAt: number;
  lastActivityAt: number;
}

export interface PrintJobMeta {
  id: string;
  protocol: Protocol;
  sourceIp: string;
  sessionId: string;
  receivedAt: number;
  byteLength: number;
  widthMm?: number;
  labelSize?: string;
  /** e.g. "tcp" | "http" | "image" */
  source?: string;
  /** Hub identifier, typically hostIp:wsPort */
  hubId?: string;
}

export interface HubInfo {
  id: string;
  name: string;
  hostIp: string;
  wsPort: number;
  httpPort: number;
  tcpPort: number;
  wsUrl: string;
  httpUrl: string;
  discoveredAt: number;
  /** "mdns" | "scan" | "manual" */
  source: "mdns" | "scan" | "manual";
}

export function hubIdFromStatus(status: HubStatus): string {
  return status.hubInstanceId;
}

export function hubEndpointKey(hostIp: string, wsPort: number): string {
  return `${normalizeHostIp(hostIp)}:${wsPort}`;
}

export function hubWsUrl(hostIp: string, wsPort: number): string {
  return `ws://${hostIp}:${wsPort}`;
}

export function hubHttpUrl(hostIp: string, httpPort: number): string {
  return `http://${hostIp}:${httpPort}`;
}

export function hubInfoFromStatus(status: HubStatus, source: HubInfo["source"] = "scan"): HubInfo {
  return {
    id: hubIdFromStatus(status),
    name: `Hub ${status.hostIp}`,
    hostIp: status.hostIp,
    wsPort: status.wsPort,
    httpPort: status.httpPort,
    tcpPort: status.tcpPort,
    wsUrl: hubWsUrl(status.hostIp, status.wsPort),
    httpUrl: hubHttpUrl(status.hostIp, status.httpPort),
    discoveredAt: Date.now(),
    source,
  };
}

export const MDNS_SERVICE_TYPE = "virt-printer";

export interface PrintJob extends PrintJobMeta {
  /** Raw print payload as received from TCP/WebSocket. */
  payload: Uint8Array;
}

export interface HubStatus {
  /** Stable id for this Bridge process (survives localhost vs LAN IP mismatch). */
  hubInstanceId: string;
  hostIp: string;
  tcpPort: number;
  wsPort: number;
  httpPort: number;
  listening: boolean;
  connections: DeviceConnection[];
  wsClients: WsClientInfo[];
}

export function normalizeHostIp(ip: string): string {
  const lower = ip.toLowerCase();
  if (lower === "localhost" || lower === "::1") return "127.0.0.1";
  if (lower.startsWith("::ffff:")) return lower.slice(7);
  return ip;
}

export type BridgeMessage =
  | { type: "hub.status"; status: HubStatus }
  | { type: "job.complete"; job: PrintJobMeta; payloadBase64: string }
  | { type: "job.start"; job: PrintJobMeta; chunkCount: number; chunkSize: number }
  | { type: "job.chunk"; id: string; index: number; dataBase64: string }
  | { type: "job.end"; id: string }
  | { type: "connection.open"; connection: DeviceConnection }
  | { type: "connection.close"; sessionId: string }
  | { type: "ws.open"; client: WsClientInfo }
  | { type: "ws.close"; sessionId: string };

export const DEFAULT_TCP_PORT = 9100;
/** WebSocket port — defaults to HTTP port when Bridge serves the unified UI. */
export const DEFAULT_WS_PORT = 8081;
export const DEFAULT_HTTP_PORT = 8081;
export const DEFAULT_HISTORY_LIMIT = 200;

/** Jobs larger than this use chunked WebSocket delivery. */
export const JOB_CHUNK_THRESHOLD = 256 * 1024;
/** Size of each chunk when streaming large jobs. */
export const JOB_CHUNK_SIZE = 64 * 1024;

export const TCP_IDLE_TIMEOUT_MS = 120_000;
export const WS_PING_INTERVAL_MS = 30_000;
