import { useMemo, useState } from "react";
import type { DeviceConnection, HubStatus, WsClientInfo } from "@virt-printer/shared";
import { DEFAULT_HTTP_PORT, DEFAULT_TCP_PORT, DEFAULT_WS_PORT, MDNS_PRINTER_SERVICE_TYPE } from "@virt-printer/shared";
import { useLocale } from "../i18n/context";
import { isDesktopApp } from "../lib/is-desktop";

interface Props {
  status: HubStatus | null;
  connected: boolean;
  wsUrl: string;
  bridgeInput: string;
  showBridgeSetup: boolean;
  lanUiUrl: string | null;
  desktopMode?: boolean;
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
  desktopMode = false,
  onBridgeInputChange,
  onConnectBridge,
  onReconnect,
}: Props) {
  const { t, format } = useLocale();
  const hostIp = status?.hostIp ?? "—";
  const tcpPort = status?.tcpPort ?? DEFAULT_TCP_PORT;
  const wsPort = status?.wsPort ?? DEFAULT_WS_PORT;
  const httpPort = status?.httpPort ?? DEFAULT_HTTP_PORT;
  const httpLabel =
    desktopMode && (status?.httpPort ?? 0) <= 0
      ? t.network.httpDisabled
      : String(httpPort);

  const grouped = useMemo(() => {
    const tcp = groupTcpConnections(status?.connections ?? []);
    const ws = groupWsClients(status?.wsClients ?? []);
    return [...tcp, ...ws];
  }, [status?.connections, status?.wsClients]);

  const bridgeOnline = desktopMode
    ? Boolean(status?.listening)
    : connected && Boolean(status?.listening);

  const bridgeStatus = desktopMode
    ? status?.listening
      ? t.network.listening
      : status
        ? t.network.bridgeOnline
        : t.network.waitingBridge
    : connected
      ? status?.listening
        ? t.network.listening
        : t.network.bridgeOnline
      : t.network.waitingBridge;

  const [lanCopied, setLanCopied] = useState(false);

  async function copyLanAddress() {
    try {
      if (desktopMode && isDesktopApp() && window.printhubDesktop) {
        const url = await window.printhubDesktop.copyLanUrl();
        if (!url) return;
      } else if (lanUiUrl) {
        await navigator.clipboard.writeText(lanUiUrl);
      } else {
        return;
      }
      setLanCopied(true);
      window.setTimeout(() => setLanCopied(false), 2000);
    } catch {
      /* clipboard denied */
    }
  }

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

      {desktopMode && lanUiUrl && (
        <div className="network-lan">
          <span className="network-lan-label">{t.network.lanAccess}</span>
          <code className="network-lan-url">{lanUiUrl}</code>
          <button type="button" className="btn-sm" onClick={() => void copyLanAddress()}>
            {lanCopied ? t.network.desktopCopiedLan : t.network.desktopCopyLan}
          </button>
        </div>
      )}

      <div className="network-row highlight">
        <div>
          <div className="network-role">{t.network.localHub}</div>
          <div className="network-meta">
            {hostIp} · TCP {tcpPort}
            {desktopMode ? ` · ${t.network.desktopTransport}` : ` / WS ${wsPort} / HTTP ${httpLabel}`}
          </div>
        </div>
        <div className="network-row-actions">
          <span className={`pill ${bridgeOnline ? "ok" : "warn"}`}>{bridgeStatus}</span>
          <button type="button" className="btn-sm" onClick={onReconnect}>
            {t.network.reconnect}
          </button>
        </div>
      </div>

      {status?.mdnsPrinter && (
        <div className="network-hint">
          {format(t.network.mdnsHint, {
            service: MDNS_PRINTER_SERVICE_TYPE,
            port: tcpPort,
          })}
        </div>
      )}

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

      {!desktopMode && (
        <div className="network-foot">
          {t.network.wsLabel}: {wsUrl}
        </div>
      )}
    </div>
  );
}
