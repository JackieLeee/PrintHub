import { useMemo } from "react";
import type { DeviceConnection, HubStatus, WsClientInfo } from "@virt-printer/shared";
import { DEFAULT_HTTP_PORT, DEFAULT_TCP_PORT, DEFAULT_WS_PORT } from "@virt-printer/shared";

interface Props {
  status: HubStatus | null;
  connected: boolean;
  wsUrl: string;
}

interface GroupedConnection {
  key: string;
  ip: string;
  kind: "TCP" | "WS";
  protocol?: string;
  count: number;
  ports: number[];
}

function groupTcpConnections(connections: DeviceConnection[]): GroupedConnection[] {
  const map = new Map<string, GroupedConnection>();
  for (const c of connections) {
    const key = `${c.ip}:${c.protocol}`;
    const entry = map.get(key) ?? {
      key,
      ip: c.ip,
      kind: "TCP" as const,
      protocol: c.protocol.toUpperCase(),
      count: 0,
      ports: [],
    };
    entry.count += 1;
    if (c.port) entry.ports.push(c.port);
    map.set(key, entry);
  }
  return [...map.values()];
}

function groupWsClients(clients: WsClientInfo[]): GroupedConnection[] {
  const map = new Map<string, GroupedConnection>();
  for (const c of clients) {
    const entry = map.get(c.ip) ?? {
      key: c.ip,
      ip: c.ip,
      kind: "WS" as const,
      count: 0,
      ports: [],
    };
    entry.count += 1;
    map.set(c.ip, entry);
  }
  return [...map.values()];
}

export function NetworkPanel({ status, connected, wsUrl }: Props) {
  const hostIp = status?.hostIp ?? "—";
  const tcpPort = status?.tcpPort ?? DEFAULT_TCP_PORT;
  const wsPort = status?.wsPort ?? DEFAULT_WS_PORT;
  const httpPort = status?.httpPort ?? DEFAULT_HTTP_PORT;

  const grouped = useMemo(() => {
    const tcp = groupTcpConnections(status?.connections ?? []);
    const ws = groupWsClients(status?.wsClients ?? []);
    return [...tcp, ...ws];
  }, [status?.connections, status?.wsClients]);

  return (
    <div className="network-panel network-panel-compact">
      <div className="network-row highlight">
        <div>
          <div className="network-role">本机 Hub</div>
          <div className="network-meta">
            {hostIp} · TCP {tcpPort} / WS {wsPort} / HTTP {httpPort}
          </div>
        </div>
        <span className={`pill ${status?.listening ? "ok" : "warn"}`}>
          {connected ? (status?.listening ? "监听中" : "Bridge 在线") : "等待 Bridge"}
        </span>
      </div>

      <div className="network-hint">
        POS 指向 <code>{hostIp}:{tcpPort}</code>
      </div>

      {grouped.length === 0 ? (
        <div className="empty">暂无连接</div>
      ) : (
        grouped.map((g) => (
          <div key={g.key} className="network-row">
            <div>
              <div className="network-role">
                {g.kind === "TCP" ? `TCP ${g.ip}` : `WebSocket ${g.ip}`}
                {g.count > 1 ? ` ×${g.count}` : ""}
              </div>
              <div className="network-meta">
                {g.kind === "TCP" && g.protocol ? `${g.protocol}` : "Web UI 订阅"}
                {g.ports.length > 0 && g.ports.length <= 3
                  ? ` · ${g.ports.join(", ")}`
                  : g.ports.length > 3
                    ? ` · ${g.ports.length} 个端口`
                    : ""}
              </div>
            </div>
            <span className="pill ok">{g.kind}</span>
          </div>
        ))
      )}

      <div className="network-foot">WebSocket: {wsUrl}</div>
    </div>
  );
}
