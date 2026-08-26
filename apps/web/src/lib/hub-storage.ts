import type { HubInfo } from "@virt-printer/shared";
import {
  DEFAULT_HTTP_PORT,
  DEFAULT_TCP_PORT,
  DEFAULT_WS_PORT,
  hubEndpointKey,
  normalizeHostIp,
} from "@virt-printer/shared";
import { hubFromWsUrl } from "./discovery";

const STORAGE_KEY = "virt-printer-hub:recent-hubs";
const SELECTED_KEY = "virt-printer-hub:selected-hub";
const MAX_HUBS = 12;

/** When UI is served from localhost, connect via loopback (avoids LAN WS failures). */
export function preferLocalWsUrl(wsUrl: string): string {
  if (typeof window === "undefined") return wsUrl;
  const pageHost = normalizeHostIp(window.location.hostname);
  if (pageHost !== "127.0.0.1") return wsUrl;
  try {
    const url = new URL(wsUrl);
    const target = normalizeHostIp(url.hostname);
    if (target === "127.0.0.1") return wsUrl;
    return `ws://127.0.0.1:${url.port || DEFAULT_WS_PORT}`;
  } catch {
    return wsUrl;
  }
}

export function adaptHubForClient(hub: HubInfo): HubInfo {
  const wsUrl = preferLocalWsUrl(hub.wsUrl);
  const url = new URL(wsUrl);
  const hostIp = normalizeHostIp(url.hostname);
  const httpPort = hub.httpPort ?? DEFAULT_HTTP_PORT;
  return {
    ...hub,
    hostIp,
    wsUrl,
    httpUrl: `http://${hostIp}:${httpPort}`,
    id: hub.id || `legacy:${hubEndpointKey(hostIp, hub.wsPort)}`,
  };
}

function sanitizeHub(raw: unknown): HubInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Partial<HubInfo>;
  try {
    let hub: HubInfo;
    if (h.wsUrl) {
      hub = { ...hubFromWsUrl(h.wsUrl), ...h, wsUrl: h.wsUrl };
    } else if (h.hostIp && h.wsPort) {
      const hostIp = normalizeHostIp(h.hostIp);
      hub = {
        id: h.id ?? `legacy:${hubEndpointKey(hostIp, h.wsPort)}`,
        name: h.name ?? `Hub ${hostIp}`,
        hostIp,
        wsPort: h.wsPort,
        httpPort: h.httpPort ?? DEFAULT_HTTP_PORT,
        tcpPort: h.tcpPort ?? DEFAULT_TCP_PORT,
        wsUrl: `ws://${hostIp}:${h.wsPort}`,
        httpUrl: `http://${hostIp}:${h.httpPort ?? DEFAULT_HTTP_PORT}`,
        discoveredAt: h.discoveredAt ?? 0,
        source: h.source ?? "manual",
      };
    } else {
      return null;
    }
    if (!hub.id) {
      hub.id = `legacy:${hubEndpointKey(hub.hostIp, hub.wsPort)}`;
    }
    return adaptHubForClient(hub);
  } catch {
    return null;
  }
}

export function loadRecentHubs(): HubInfo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeHub).filter((h): h is HubInfo => h !== null);
  } catch {
    return [];
  }
}

export function saveRecentHubs(hubs: HubInfo[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hubs.slice(0, MAX_HUBS)));
}

export function rememberHub(hub: HubInfo): HubInfo[] {
  const normalized = adaptHubForClient(hub);
  const prev = loadRecentHubs().filter((h) => h.id !== normalized.id);
  const next = [{ ...normalized, discoveredAt: Date.now() }, ...prev].slice(0, MAX_HUBS);
  saveRecentHubs(next);
  return next;
}

export function loadSelectedHubId(): string | null {
  return localStorage.getItem(SELECTED_KEY);
}

export function saveSelectedHubId(id: string): void {
  localStorage.setItem(SELECTED_KEY, id);
}

export function mergeHubLists(...lists: HubInfo[][]): HubInfo[] {
  const byEndpoint = new Map<string, HubInfo>();
  for (const list of lists) {
    for (const raw of list) {
      const h = sanitizeHub(raw);
      if (!h) continue;
      const endpoint = hubEndpointKey(h.hostIp, h.wsPort);
      const prev = byEndpoint.get(endpoint);
      if (!prev || isPreferredHub(h, prev)) {
        byEndpoint.set(endpoint, h);
      }
    }
  }
  return [...byEndpoint.values()].sort((a, b) => a.hostIp.localeCompare(b.hostIp));
}

function isPreferredHub(next: HubInfo, prev: HubInfo): boolean {
  const nextPending = !next.id || next.id.startsWith("pending:");
  const prevPending = !prev.id || prev.id.startsWith("pending:");
  if (!nextPending && prevPending) return true;
  if (nextPending && !prevPending) return false;
  return (next.discoveredAt ?? 0) >= (prev.discoveredAt ?? 0);
}
