import type { HubStatus, PrinterSimConfig } from "@virt-printer/shared";
import { DEFAULT_TCP_PORT } from "@virt-printer/shared";
import { useLocale } from "../i18n/context";
import { DisclosureToggle } from "./DisclosureToggle";
import { NetworkPanel } from "./NetworkPanel";
import { PrinterSimPanel } from "./PrinterSimPanel";
import { RawPrintPanel } from "./RawPrintPanel";

export type WorkbenchRightTab = "network" | "debug";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rightTab: WorkbenchRightTab;
  onRightTabChange: (tab: WorkbenchRightTab) => void;
  status: HubStatus | null;
  connected: boolean;
  desktopMode: boolean;
  wsUrl: string;
  bridgeInput: string;
  showBridgeSetup: boolean;
  lanUiUrl: string | null;
  httpBase: string;
  onBridgeInputChange: (value: string) => void;
  onConnectBridge: () => void;
  onReconnect: () => void;
  onPreview: (payload: Uint8Array, label: string) => void;
  onSimConfigChange: (config: PrinterSimConfig) => void;
  onSimEventsClear: () => void;
}

export function WorkbenchPanel({
  open,
  onOpenChange,
  rightTab,
  onRightTabChange,
  status,
  connected,
  desktopMode,
  wsUrl,
  bridgeInput,
  showBridgeSetup,
  lanUiUrl,
  httpBase,
  onBridgeInputChange,
  onConnectBridge,
  onReconnect,
  onPreview,
  onSimConfigChange,
  onSimEventsClear,
}: Props) {
  const { t, format } = useLocale();
  const scenario = status?.printerSim?.scenario ?? "normal";
  const hostIp = status?.hostIp;
  const tcpPort = status?.tcpPort ?? DEFAULT_TCP_PORT;
  const bridgeOk = desktopMode ? Boolean(status?.listening) : connected;
  const connectionCount = status?.connections?.length ?? 0;

  const header = (
    <button
      type="button"
      className="workbench-header workbench-header-btn"
      aria-expanded={open}
      onClick={() => onOpenChange(!open)}
    >
      <DisclosureToggle open={open} />
      <span className="workbench-header-title">{t.workbench.title}</span>
      <span className={`pill ${scenario === "normal" ? "ok" : "warn"}`}>
        {t.sim.scenarios[scenario]}
      </span>
      <span className={`pill ${bridgeOk ? "ok" : "warn"}`}>
        {bridgeOk ? t.network.bridgeOnline : t.network.waitingBridge}
      </span>
      {hostIp && (
        <span className="workbench-header-meta">
          {hostIp} · TCP {tcpPort}
        </span>
      )}
      <span className="workbench-header-meta workbench-header-meta--end">
        {format(t.workbench.connectionsShort, { n: connectionCount })}
      </span>
    </button>
  );

  return (
    <section
      className={`workbench panel${open ? "" : " workbench--collapsed-shell"}`}
      aria-label={t.workbench.title}
    >
      {header}
      {open && (
        <div className="workbench-split">
          <div className="workbench-sim">
            <PrinterSimPanel
              compact
              httpBase={httpBase}
              config={status?.printerSim ?? null}
              events={status?.simEvents ?? []}
              liveState={status?.simLiveState ?? null}
              tcpQueue={status?.tcpQueue ?? []}
              connected={connected}
              onConfigChange={onSimConfigChange}
              onEventsClear={onSimEventsClear}
            />
          </div>

          <div className="workbench-right">
            <div className="workbench-tabs" role="tablist" aria-label={t.workbench.title}>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === "network"}
                className={`workbench-tab ${rightTab === "network" ? "active" : ""}`}
                onClick={() => onRightTabChange("network")}
              >
                {t.toolbelt.network}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === "debug"}
                className={`workbench-tab ${rightTab === "debug" ? "active" : ""}`}
                onClick={() => onRightTabChange("debug")}
              >
                {t.toolbelt.debug}
              </button>
            </div>

            <div className="workbench-right-body">
              {rightTab === "network" ? (
                <NetworkPanel
                  status={status}
                  connected={connected}
                  wsUrl={desktopMode ? "IPC (desktop)" : wsUrl}
                  bridgeInput={bridgeInput}
                  showBridgeSetup={showBridgeSetup}
                  lanUiUrl={lanUiUrl}
                  desktopMode={desktopMode}
                  onBridgeInputChange={onBridgeInputChange}
                  onConnectBridge={onConnectBridge}
                  onReconnect={onReconnect}
                />
              ) : (
                <RawPrintPanel onPreview={onPreview} />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
