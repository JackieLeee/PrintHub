import { useEffect, useMemo, useState } from "react";
import type { PrinterSimConfig, PrinterSimEvent, PrinterSimScenario } from "@virt-printer/shared";
import { useLocale } from "../i18n/context";
import { sortSimEvents } from "../lib/local-sim";
import { kickCashDrawer, updateSimConfig } from "../lib/printer-sim-api";
interface Props {
  httpBase: string;
  config: PrinterSimConfig | null;
  events: PrinterSimEvent[];
  connected: boolean;
  onConfigChange: (config: PrinterSimConfig) => void;
}

const SCENARIOS: PrinterSimScenario[] = [
  "normal",
  "paper-out",
  "cover-open",
  "offline",
  "slow",
  "reject-job",
];

type SignalColor = "green" | "yellow" | "red";

function scenarioSignal(scenario: PrinterSimScenario, statusDelayMs = 0): SignalColor {
  if (scenario === "normal") return "green";
  if (scenario === "slow") return statusDelayMs > 0 ? "yellow" : "green";
  return "red";
}

function formatEventTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function PrinterSimPanel({
  httpBase,
  config,
  events,
  connected,
  onConfigChange,
}: Props) {
  const { t, format } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [delayMs, setDelayMs] = useState(config?.statusDelayMs ?? 0);

  useEffect(() => {
    setDelayMs(config?.statusDelayMs ?? 0);
  }, [config?.statusDelayMs]);

  useEffect(() => {
    const latest = events.find(
      (e) => e.kind === "cash-drawer" || e.kind === "manual-drawer",
    );
    if (latest) setDrawerOpen(true);
  }, [events]);

  const scenario = config?.scenario ?? "normal";
  const statusDelayMs = config?.statusDelayMs ?? 0;
  const sortedEvents = useMemo(() => sortSimEvents(events), [events]);

  async function setScenario(next: PrinterSimScenario) {
    if (!connected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateSimConfig(httpBase, { scenario: next });
      onConfigChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function commitDelay(ms: number) {
    if (!connected) return;
    setError(null);
    try {
      const updated = await updateSimConfig(httpBase, { statusDelayMs: ms });
      onConfigChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleOpenDrawer() {
    setError(null);
    setDrawerOpen(true);
    if (!connected || busy) return;
    setBusy(true);
    try {
      await kickCashDrawer(httpBase, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleCloseDrawer() {
    setDrawerOpen(false);
  }

  return (
    <div className="printer-sim-panel">
      <div className="printer-sim-header">
        <h3>{t.sim.title}</h3>
        <span className="printer-sim-hint">{t.sim.hint}</span>
        {!connected && <span className="printer-sim-offline">{t.sim.bridgeRequired}</span>}
      </div>

      <div className="printer-sim-scenarios">
        <span className="printer-sim-field-label">{t.sim.scenario}</span>
        <div className="sim-scenario-group" role="radiogroup" aria-label={t.sim.scenario}>
          {SCENARIOS.map((s) => {
            const active = scenario === s;
            const signal =
              s === "slow"
                ? scenarioSignal("slow", active ? delayMs : statusDelayMs)
                : scenarioSignal(s);
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                data-signal={active ? signal : undefined}
                className={`sim-scenario-btn ${active ? "active" : ""}`}
                disabled={!connected || busy}
                onClick={() => void setScenario(s)}
              >
                {active && <span className="status-led" aria-hidden="true" />}
                {t.sim.scenarios[s]}
              </button>
            );
          })}
        </div>
      </div>

      {(scenario === "slow" || statusDelayMs > 0) && (
        <div className="printer-sim-field">
          <label htmlFor="sim-delay">{t.sim.statusDelay}</label>
          <input
            id="sim-delay"
            type="range"
            min={0}
            max={3000}
            step={100}
            value={delayMs}
            disabled={!connected}
            onChange={(e) => setDelayMs(Number(e.target.value))}
            onPointerUp={(e) => void commitDelay(Number(e.currentTarget.value))}
            onKeyUp={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                void commitDelay(Number(e.currentTarget.value));
              }
            }}
          />
          <span className="printer-sim-delay-value">{delayMs} ms</span>
        </div>
      )}

      <div className={`cash-drawer-unit ${drawerOpen ? "open" : ""}`}>
        <div className="cash-drawer-visual" aria-hidden="true">
          <div className="cash-drawer-printer">
            <div className="cash-drawer-printer-face" />
            <div className="cash-drawer-assembly">
              <div className="cash-drawer-housing">
                <div className="cash-drawer-cavity" />
              </div>
              <div className={`cash-drawer-tray ${drawerOpen ? "open" : ""}`}>
                <div className="cash-drawer-tray-body">
                  <div className="cash-drawer-tray-inner">
                    <span className="cash-drawer-bill" />
                    <span className="cash-drawer-bill" />
                    <span className="cash-drawer-coin" />
                    <span className="cash-drawer-coin" />
                  </div>
                </div>
                <div className="cash-drawer-tray-lip">
                  <span className="cash-drawer-handle" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="cash-drawer-meta">
          <div
            className={`cash-drawer-label sim-status-badge sim-status-badge--${drawerOpen ? "green" : "red"}`}
          >
            <span className="status-led" aria-hidden="true" />
            <span>{drawerOpen ? t.sim.drawerOpen : t.sim.drawerClosed}</span>
          </div>
          <div className="cash-drawer-actions">
            <button
              type="button"
              className="btn-sm"
              disabled={busy || drawerOpen}
              onClick={() => void handleOpenDrawer()}
            >
              {t.sim.openDrawer}
            </button>
            <button
              type="button"
              className="btn-sm"
              disabled={!drawerOpen}
              onClick={handleCloseDrawer}
            >
              {t.sim.closeDrawer}
            </button>
          </div>
        </div>
      </div>

      <div className="sim-events">
        <div className="sim-events-head">
          <div className="sim-events-title">{t.sim.events}</div>
          <span className="sim-events-count">{format(t.history.totalCount, { n: sortedEvents.length })}</span>
        </div>
        {sortedEvents.length === 0 ? (
          <div className="sim-events-empty">{t.sim.eventsEmpty}</div>
        ) : (
          <ul className="sim-events-list">
            {sortedEvents.map((ev) => (
              <li key={ev.id} className={`sim-event sim-event--${ev.kind}`}>
                <span className="sim-event-time">{formatEventTime(ev.at)}</span>
                <span className="sim-event-kind">{t.sim.eventKinds[ev.kind]}</span>
                <span className="sim-event-detail">{ev.detail}</span>
                {ev.sourceIp && <span className="sim-event-ip">{ev.sourceIp}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="sim-error">{error}</p>}
    </div>
  );
}
