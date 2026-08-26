import type { HubInfo, HubStatus } from "@virt-printer/shared";
import {
  DEFAULT_HTTP_PORT,
  DEFAULT_TCP_PORT,
  DEFAULT_WS_PORT,
  hubEndpointKey,
  hubInfoFromStatus,
  normalizeHostIp,
} from "@virt-printer/shared";

const PROBE_TIMEOUT_MS = 900;
const BATCH_SIZE = 24;

/** Guess local /24 subnet using WebRTC (works in most browsers). */
export function detectLocalSubnet(): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof RTCPeerConnection === "undefined") {
      resolve(null);
      return;
    }

    const pc = new RTCPeerConnection({ iceServers: [] });
    let resolved = false;
    const done = (subnet: string | null) => {
      if (resolved) return;
      resolved = true;
      pc.close();
      resolve(subnet);
    };

    pc.createDataChannel("probe");
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => done(null));

    pc.onicecandidate = (event) => {
      const cand = event.candidate?.candidate ?? "";
      const m = /(\d{1,3}(?:\.\d{1,3}){3})/.exec(cand);
      if (!m) return;
      const ip = m[1]!;
      if (ip.startsWith("127.") || ip.startsWith("169.254.")) return;
      const parts = ip.split(".");
      done(`${parts[0]}.${parts[1]}.${parts[2]}`);
    };

    setTimeout(() => done(null), 2500);
  });
}

async function probeHub(ip: string, httpPort = DEFAULT_HTTP_PORT): Promise<HubInfo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`http://${ip}:${httpPort}/status`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const status = (await res.json()) as HubStatus;
    return hubInfoFromStatus(status, "scan");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function scanSubnetForHubs(subnet: string, httpPort = DEFAULT_HTTP_PORT): Promise<HubInfo[]> {
  const ips: string[] = [];
  for (let i = 1; i <= 254; i++) ips.push(`${subnet}.${i}`);

  const found: HubInfo[] = [];
  for (let i = 0; i < ips.length; i += BATCH_SIZE) {
    const batch = ips.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((ip) => probeHub(ip, httpPort)));
    for (const hub of results) {
      if (hub) found.push(hub);
    }
  }
  return dedupeHubs(found);
}

export async function discoverHubs(options?: {
  subnet?: string | null;
  httpPort?: number;
  extraIps?: string[];
}): Promise<HubInfo[]> {
  const httpPort = options?.httpPort ?? DEFAULT_HTTP_PORT;
  const subnet = options?.subnet ?? (await detectLocalSubnet());
  const hubs: HubInfo[] = [];

  if (subnet) {
    hubs.push(...(await scanSubnetForHubs(subnet, httpPort)));
  }

  for (const ip of options?.extraIps ?? ["127.0.0.1", "localhost"]) {
    const hub = await probeHub(ip, httpPort);
    if (hub) hubs.push(hub);
  }

  return dedupeHubs(hubs);
}

export function hubFromWsUrl(wsUrl: string): HubInfo {
  const url = new URL(wsUrl);
  const hostIp = normalizeHostIp(url.hostname);
  const wsPort = Number(url.port || DEFAULT_WS_PORT);
  const httpPort = DEFAULT_HTTP_PORT;
  const tcpPort = DEFAULT_TCP_PORT;
  const endpoint = hubEndpointKey(hostIp, wsPort);
  return {
    id: `pending:${endpoint}`,
    name: `Hub ${hostIp}`,
    hostIp,
    wsPort,
    httpPort,
    tcpPort,
    wsUrl,
    httpUrl: `http://${hostIp}:${httpPort}`,
    discoveredAt: Date.now(),
    source: "manual",
  };
}

function dedupeHubs(hubs: HubInfo[]): HubInfo[] {
  const byEndpoint = new Map<string, HubInfo>();
  for (const h of hubs) {
    if (!h?.hostIp || !h?.wsPort) continue;
    const endpoint = hubEndpointKey(h.hostIp, h.wsPort);
    const prev = byEndpoint.get(endpoint);
    const hPending = !h.id || h.id.startsWith("pending:");
    const prevPending = !prev?.id || prev.id.startsWith("pending:");
    if (!prev || (prevPending && !hPending)) {
      byEndpoint.set(endpoint, h);
    }
  }
  return [...byEndpoint.values()].sort((a, b) => a.hostIp.localeCompare(b.hostIp));
}
