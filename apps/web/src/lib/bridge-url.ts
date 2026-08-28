import { DEFAULT_HTTP_PORT } from "@virt-printer/shared";

const STORAGE_KEY = "virt-printer-hub:bridge-base";

const EXTERNAL_DEMO_HOSTS = ["github.io", "githubusercontent.com", "pages.dev"];

/** Page is served from GitHub Pages or similar — not from local Bridge. */
export function isExternalDemoHost(hostname = window.location.hostname): boolean {
  return EXTERNAL_DEMO_HOSTS.some((h) => hostname.includes(h));
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Page is served by Bridge (UI shares the HTTP/WS port). */
export function isBridgeOrigin(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV) return false;
  if (isExternalDemoHost()) return false;
  if (window.printhubDesktop?.isDesktop) return true;

  const port = window.location.port;
  const hostname = window.location.hostname;

  // Electron ui-server uses random 127.0.0.1 ports — not the Bridge HTTP port.
  if (isLoopbackHost(hostname)) {
    return port === String(DEFAULT_HTTP_PORT) || port === "";
  }

  return port === String(DEFAULT_HTTP_PORT) || port === "";
}

export function normalizeBridgeBase(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("empty bridge address");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return new URL(trimmed).origin;
  }
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    const u = new URL(trimmed);
    const proto = u.protocol === "wss:" ? "https:" : "http:";
    return `${proto}//${u.host}`;
  }
  return `http://${trimmed}`;
}

export function bridgeBaseToWsUrl(base: string): string {
  const u = new URL(base.startsWith("http") ? base : `http://${base}`);
  const proto = u.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${u.host}`;
}

export function loadBridgeBase(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveBridgeBase(base: string): void {
  localStorage.setItem(STORAGE_KEY, normalizeBridgeBase(base));
}

export function resolveBridgeWsUrl(): string {
  if (typeof window === "undefined") return `ws://127.0.0.1:${DEFAULT_HTTP_PORT}`;

  const params = new URLSearchParams(window.location.search);
  const wsOverride = params.get("ws");
  if (wsOverride) return wsOverride;

  const bridgeParam = params.get("bridge");
  if (bridgeParam) {
    const base = normalizeBridgeBase(bridgeParam);
    saveBridgeBase(base);
    return bridgeBaseToWsUrl(base);
  }

  if (isBridgeOrigin()) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }

  const stored = loadBridgeBase();
  if (stored) return bridgeBaseToWsUrl(stored);

  if (import.meta.env.DEV) {
    const host = window.location.hostname;
    return `ws://${host === "localhost" ? "localhost" : host}:${DEFAULT_HTTP_PORT}`;
  }

  return `ws://127.0.0.1:${DEFAULT_HTTP_PORT}`;
}

export function resolveHttpBaseFromBridge(statusHostIp: string | null): string {
  if (typeof window === "undefined") {
    return `http://${statusHostIp ?? "localhost"}:${DEFAULT_HTTP_PORT}`;
  }

  if (isBridgeOrigin()) {
    return window.location.origin;
  }

  const stored = loadBridgeBase();
  if (stored) return stored;

  const host = statusHostIp ?? window.location.hostname;
  return `http://${host}:${DEFAULT_HTTP_PORT}`;
}

export function lanUiUrl(hostIp: string, httpPort = DEFAULT_HTTP_PORT): string {
  return `http://${hostIp}:${httpPort}`;
}
