import { useMemo } from "react";
import type { DeviceConnection, HubStatus, WsClientInfo } from "@virt-printer/shared";
import { DEFAULT_HTTP_PORT, DEFAULT_TCP_PORT, DEFAULT_WS_PORT } from "@virt-printer/shared";
import { useLocale } from "../i18n/context";

interface Props {
  status: HubStatus | null;
  connected: boolean;
  wsUrl: string;
  bridgeInput: string;
  showBridgeSetup: boolean;
  lanUiUrl: string | null;
  onBridgeInputChange: (value: string) => void;
  onConnectBridge: () => void;
  onReconnect: () => void;
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

export function NetworkPanel({
  status,
  connected,
  wsUrl,
  bridgeInput,
  showBridgeSetup,
  lanUiUrl,
  onBridgeInputChange,
  onConnectBridge,
  onReconnect,
}: Props) {
  const { t, format } = useLocale();
  const hostIp = status?.hostIp ?? "—";
  const tcpPort = status?.tcpPort ?? DEFAULT_TCP_PORT;
  const wsPort = status?.wsPort ?? DEFAULT_WS_PORT;
  const httpPort = status?.httpPort ?? DEFAULT_HTTP_PORT;

  const grouped = useMemo(() => {
    const tcp = groupTcpConnections(status?.connections ?? []);
    const ws = groupWsClients(status?.wsClients ?? []);
    return [...tcp, ...ws];
  }, [status?.connections, status?.wsClients]);

  const bridgeStatus = connected
    ? status?.listening
      ? t.network.listening
      : t.network.bridgeOnline
    : t.network.waitingBridge;

  return (
    <div className="network-panel network-panel-compact">
      {showBridgeSetup && (
        <div className="network-setup">
          <div className="network-setup-title">{t.network.bridgeSetupTitle}</div>
          <p className="network-setup-hint">{t.network.bridgeSetupHint}</p>
          <div className="network-setup-row">
            <input
              value={bridgeInput}
              onChange={(e) => onBridgeInputChange(e.target.value)}
              placeholder={t.network.bridgePlaceholder}
              onKeyDown={(e) => e.key === "Enter" && onConnectBridge()}
            />
            <button type="button" onClick={onConnectBridge}>
              {t.network.bridgeConnect}
            </button>
          </div>
        </div>
      )}

      {lanUiUrl && (
        <div className="network-lan">
          <span className="network-lan-label">{t.network.lanAccess}</span>
          <code className="network-lan-url">{lanUiUrl}</code>
        </div>
      )}

      <div className="network-row highlight">
        <div>
          <div className="network-role">{t.network.localHub}</div>
          <div className="network-meta">
            {hostIp} · TCP {tcpPort} / WS {wsPort} / HTTP {httpPort}
          </div>
        </div>
        <div className="network-row-actions">
          <span className={`pill ${connected && status?.listening ? "ok" : "warn"}`}>{bridgeStatus}</span>
          <button type="button" className="btn-sm" onClick={onReconnect}>
            {t.network.reconnect}
          </button>
        </div>
      </div>

      <div className="network-hint">
        {t.network.posHint} <code>{hostIp}:{tcpPort}</code>
      </div>

      {grouped.length === 0 ? (
        <div className="empty">{t.network.noConnections}</div>
      ) : (
        grouped.map((g) => (
          <div key={g.key} className="network-row">
            <div>
              <div className="network-role">
                {g.kind === "TCP" ? `TCP ${g.ip}` : `${t.network.wsLabel} ${g.ip}`}
                {g.count > 1 ? ` ×${g.count}` : ""}
              </div>
              <div className="network-meta">
                {g.kind === "TCP" && g.protocol ? `${g.protocol}` : t.network.webSubscribe}
                {g.ports.length > 0 && g.ports.length <= 3
                  ? ` · ${g.ports.join(", ")}`
                  : g.ports.length > 3
                    ? ` · ${format(t.network.portCount, { n: g.ports.length })}`
                    : ""}
              </div>
            </div>
            <span className="pill ok">{g.kind}</span>
          </div>
        ))
      )}

      <div className="network-foot">
        {t.network.wsLabel}: {wsUrl}
      </div>
    </div>
  );
}
