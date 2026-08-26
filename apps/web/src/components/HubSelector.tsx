import { useState } from "react";
import type { HubInfo } from "@virt-printer/shared";
import { hubEndpointKey } from "@virt-printer/shared";
import { hubFromWsUrl } from "../lib/discovery";

interface Props {
  hubs: HubInfo[];
  selectedHubId: string | null;
  wsUrl: string;
  connected: boolean;
  scanning: boolean;
  onScan: () => void;
  onSelectHub: (hub: HubInfo) => void;
  onWsUrlChange: (url: string) => void;
  onConnect: () => void;
}

export function HubSelector({
  hubs,
  selectedHubId,
  wsUrl,
  connected,
  scanning,
  onScan,
  onSelectHub,
  onWsUrlChange,
  onConnect,
}: Props) {
  const [showManual, setShowManual] = useState(false);

  function connectManual() {
    const hub = hubFromWsUrl(wsUrl);
    onSelectHub(hub);
    onConnect();
  }

  return (
    <div className="hub-selector">
      <div className="hub-toolbar">
        <button type="button" onClick={onScan} disabled={scanning}>
          {scanning ? "扫描中…" : "扫描局域网 Hub"}
        </button>
        <button type="button" onClick={onConnect}>
          重连
        </button>
        <span className={`badge ${connected ? "ok" : "err"}`}>
          {connected ? "已连接" : "未连接"}
        </span>
      </div>

      {hubs.length === 0 ? (
        <div className="empty">未发现 Hub，请启动 Bridge 或手动输入 WS 地址</div>
      ) : (
        <ul className="hub-list">
          {hubs.map((hub) => (
            <li key={hub.id || hubEndpointKey(hub.hostIp, hub.wsPort)}>
              <button
                type="button"
                className={`hub-item ${hub.id === selectedHubId ? "active" : ""}`}
                onClick={() => {
                  onSelectHub(hub);
                  if (hub.wsUrl === wsUrl) onConnect();
                }}
              >
                <span className="hub-name">{hub.name}</span>
                <span className="hub-meta">
                  {hub.hostIp} · WS {hub.wsPort} · HTTP {hub.httpPort}
                </span>
                <span className={`pill ${hub.source === "manual" ? "warn" : "ok"}`}>{hub.source}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="link-btn" onClick={() => setShowManual((v) => !v)}>
        {showManual ? "隐藏手动输入" : "手动 WS 地址"}
      </button>

      {showManual && (
        <div className="hub-manual">
          <input
            value={wsUrl}
            onChange={(e) => onWsUrlChange(e.target.value)}
            placeholder="ws://192.168.1.42:8080"
          />
          <button type="button" onClick={connectManual}>
            连接
          </button>
        </div>
      )}
    </div>
  );
}
