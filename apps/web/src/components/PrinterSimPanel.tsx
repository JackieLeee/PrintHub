import { useEffect, useMemo, useRef, useState } from "react";
import type {
  PrinterSimConfig,
  PrinterSimEvent,
  PrinterSimEventKind,
  PrinterSimLiveState,
  PrinterSimScenario,
  TcpQueueEntry,
  TcpQueueState,
} from "@virt-printer/shared";
import {
  MAX_PRINT_DELAY_MS,
  MAX_STATUS_DELAY_MS,
  computeSimLiveState,
} from "@virt-printer/shared";
import { useLocale } from "../i18n/context";
import { formatDuration } from "../lib/format-duration";
import { sortSimEvents } from "../lib/local-sim";
import { kickCashDrawer, updateSimConfig } from "../lib/printer-sim-api";

interface Props {
  httpBase: string;
  config: PrinterSimConfig | null;
  events: PrinterSimEvent[];
  liveState: PrinterSimLiveState | null;
  tcpQueue: TcpQueueEntry[];
  connected: boolean;
  compact?: boolean;
  onConfigChange: (config: PrinterSimConfig) => void;
  onEventsClear?: () => void;
}

const SCENARIOS: PrinterSimScenario[] = [
  "normal",
  "paper-out",
  "cover-open",
  "offline",
  "slow",
  "reject-job",
];

type EventTab = "all" | "polls" | "jobs" | "drawer";
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

function formatPollByte(byte: number): string {
  return `0x${byte.toString(16).padStart(2, "0").toUpperCase()}`;
}

/** Legacy sim events used placeholder labels instead of client IPs. */
function formatEventSource(sourceIp: string | undefined): string | null {
  if (!sourceIp) return null;
  if (sourceIp === "ui" || sourceIp === "desktop") return "127.0.0.1";
  return sourceIp;
}

function matchesEventTab(kind: PrinterSimEventKind, tab: EventTab): boolean {
  if (tab === "all") return true;
  if (tab === "polls") return kind === "status-poll";
  if (tab === "jobs") return kind === "job-rejected" || kind === "job-completed";
  return kind === "cash-drawer" || kind === "manual-drawer";
}

function queueStateLabel(
  state: TcpQueueState,
  t: ReturnType<typeof useLocale>["t"],
): string {
  if (state === "receiving") return t.sim.queueReceiving;
  if (state === "queued") return t.sim.queueQueued;
  return t.sim.queueProcessing;
}

export function PrinterSimPanel({
  httpBase,
  config,
  events,
  liveState: liveStateProp,
  tcpQueue,
  connected,
  compact = false,
  onConfigChange,
  onEventsClear,
}: Props) {
  const { t, format } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statusDelayMs, setStatusDelayMs] = useState(config?.statusDelayMs ?? 0);
  const [printDelayMs, setPrintDelayMs] = useState(config?.printDelayMs ?? 0);
  const [eventTab, setEventTab] = useState<EventTab>("all");
  const lastDrawerEventIdRef = useRef<string | null>(null);
  const drawerEventsInitializedRef = useRef(false);

  useEffect(() => {
    setStatusDelayMs(config?.statusDelayMs ?? 0);
  }, [config?.statusDelayMs]);

  useEffect(() => {
    setPrintDelayMs(config?.printDelayMs ?? 0);
  }, [config?.printDelayMs]);

  useEffect(() => {
    const drawerEvents = events.filter(
      (e) => e.kind === "cash-drawer" || e.kind === "manual-drawer",
    );
    if (drawerEvents.length === 0) {
      lastDrawerEventIdRef.current = null;
      drawerEventsInitializedRef.current = false;
      return;
    }

    const latest = drawerEvents.reduce((a, b) => (a.at >= b.at ? a : b));

    if (!drawerEventsInitializedRef.current) {
      drawerEventsInitializedRef.current = true;
      lastDrawerEventIdRef.current = latest.id;
      return;
    }

    if (latest.id !== lastDrawerEventIdRef.current) {
      lastDrawerEventIdRef.current = latest.id;
      setDrawerOpen(true);
    }
  }, [events]);

  const scenario = config?.scenario ?? "normal";
  const configStatusDelayMs = config?.statusDelayMs ?? 0;

  const liveState = useMemo(() => {
    if (liveStateProp) return liveStateProp;
    if (config) return computeSimLiveState(config.scenario, tcpQueue.length);
    return null;
  }, [liveStateProp, config, tcpQueue.length]);

  const sortedEvents = useMemo(() => sortSimEvents(events), [events]);
  const filteredEvents = useMemo(
    () => sortedEvents.filter((ev) => matchesEventTab(ev.kind, eventTab)),
    [sortedEvents, eventTab],
  );

  async function patchConfig(partial: Partial<PrinterSimConfig>) {
    if (!connected) return;
    setError(null);
    try {
      const updated = await updateSimConfig(httpBase, partial);
      onConfigChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function setScenario(next: PrinterSimScenario) {
    if (!connected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const partial: Partial<PrinterSimConfig> = { scenario: next };
      if (scenario === "slow" && next !== "slow") {
        partial.statusDelayMs = 0;
        setStatusDelayMs(0);
      }
      const updated = await updateSimConfig(httpBase, partial);
      onConfigChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
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

  function handleDrawerSwitch(next: boolean) {
    if (next) void handleOpenDrawer();
    else handleCloseDrawer();
  }

  async function handleClearEvents() {
    if (busy || sortedEvents.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      onEventsClear?.();
    } finally {
      setBusy(false);
    }
  }

  const panelClass = compact ? "printer-sim-panel printer-sim-panel--compact" : "printer-sim-panel";

  return (
    <div className={panelClass}>
      <div className="printer-sim-header">
        <h3>{t.sim.title}</h3>
        {!compact && <span className="printer-sim-hint">{t.sim.hint}</span>}
        {!connected && <span className="printer-sim-offline">{t.sim.bridgeRequired}</span>}
      </div>

      <div className="printer-sim-scenarios">
        <span className="printer-sim-field-label">{t.sim.scenario}</span>
        <div className="sim-scenario-group" role="radiogroup" aria-label={t.sim.scenario}>
          {SCENARIOS.map((s) => {
            const active = scenario === s;
            const signal =
              s === "slow"
                ? scenarioSignal("slow", active ? statusDelayMs : configStatusDelayMs)
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

      {(scenario === "slow" || configStatusDelayMs > 0) && (
        <div className="printer-sim-field">
          <label htmlFor="sim-status-delay">{t.sim.statusDelay}</label>
          <input
            id="sim-status-delay"
            type="range"
            min={0}
            max={MAX_STATUS_DELAY_MS}
            step={100}
            value={statusDelayMs}
            disabled={!connected}
            onChange={(e) => setStatusDelayMs(Number(e.target.value))}
            onPointerUp={(e) => void patchConfig({ statusDelayMs: Number(e.currentTarget.value) })}
            onKeyUp={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                void patchConfig({ statusDelayMs: Number(e.currentTarget.value) });
              }
            }}
          />
          <span className="printer-sim-delay-value">{formatDuration(statusDelayMs)}</span>
        </div>
      )}

      <div className="printer-sim-field">
        <label htmlFor="sim-print-delay">{t.sim.printDelay}</label>
        <input
          id="sim-print-delay"
          type="range"
          min={0}
          max={MAX_PRINT_DELAY_MS}
          step={100}
          value={printDelayMs}
          disabled={!connected}
          onChange={(e) => setPrintDelayMs(Number(e.target.value))}
          onPointerUp={(e) => void patchConfig({ printDelayMs: Number(e.currentTarget.value) })}
          onKeyUp={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              void patchConfig({ printDelayMs: Number(e.currentTarget.value) });
            }
          }}
        />
        <span className="printer-sim-delay-value">{formatDuration(printDelayMs)}</span>
      </div>

      {liveState && (
        <div className="sim-live-state">
          <div className="sim-live-state-title">{t.sim.liveState}</div>
          <div className="sim-live-state-grid">
            <div className={`sim-live-cell ${liveState.online ? "ok" : "fault"}`}>
              <span className="sim-live-label">{t.sim.liveOnline}</span>
              <span className="sim-live-value">
                {liveState.online ? t.sim.stateOnline : t.sim.stateOffline}
              </span>
            </div>
            <div className={`sim-live-cell ${liveState.paperOut ? "fault" : "ok"}`}>
              <span className="sim-live-label">{t.sim.livePaper}</span>
              <span className="sim-live-value">
                {liveState.paperOut ? t.sim.stateFault : t.sim.stateOk}
              </span>
            </div>
            <div className={`sim-live-cell ${liveState.coverOpen ? "fault" : "ok"}`}>
              <span className="sim-live-label">{t.sim.liveCover}</span>
              <span className="sim-live-value">
                {liveState.coverOpen ? t.sim.stateFault : t.sim.stateOk}
              </span>
            </div>
            <div className={`sim-live-cell ${liveState.queueDepth > 0 ? "warn" : "ok"}`}>
              <span className="sim-live-label">{t.sim.liveQueue}</span>
              <span className="sim-live-value">{liveState.queueDepth}</span>
            </div>
          </div>
        </div>
      )}

      {connected && tcpQueue.length > 0 && (
        <div className="sim-tcp-queue">
          <div className="sim-tcp-queue-title">{t.sim.tcpQueue}</div>
          <ul className="sim-tcp-queue-list">
            {tcpQueue.map((entry) => (
              <li key={entry.sessionId} className={`sim-queue-item sim-queue-item--${entry.state}`}>
                <span className="sim-queue-state">{queueStateLabel(entry.state, t)}</span>
                <span className="sim-queue-ip">{entry.sourceIp}</span>
                <span className="sim-queue-bytes">{entry.bufferedBytes} B</span>
              </li>
            ))}
          </ul>
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
          <span className="cash-drawer-label">{t.sim.drawerSection}</span>
          <label className="drawer-switch" title={drawerOpen ? t.sim.drawerOpen : t.sim.drawerClosed}>
            <input
              type="checkbox"
              checked={drawerOpen}
              disabled={busy}
              onChange={(e) => handleDrawerSwitch(e.target.checked)}
            />
            <span className="drawer-switch-track" aria-hidden="true" />
          </label>
          <span
            className={`sim-status-badge sim-status-badge--${drawerOpen ? "green" : "red"}`}
          >
            <span className="status-led" aria-hidden="true" />
            {drawerOpen ? t.sim.drawerOpen : t.sim.drawerClosed}
          </span>
        </div>
      </div>

      <div className="sim-events sim-events--primary">
        <div className="sim-events-head">
          <div className="sim-events-title">{t.sim.events}</div>
          <div className="sim-events-head-actions">
            <span className="sim-events-count">
              {format(t.history.totalCount, { n: filteredEvents.length })}
            </span>
            <button
              type="button"
              className="btn-sm btn-ghost"
              disabled={busy || sortedEvents.length === 0}
              onClick={() => void handleClearEvents()}
            >
              {t.sim.clearEvents}
            </button>
          </div>
        </div>
        <div className="sim-event-tabs" role="tablist" aria-label={t.sim.events}>
          {(
            [
              ["all", t.sim.eventTabAll],
              ["polls", t.sim.eventTabPolls],
              ["jobs", t.sim.eventTabJobs],
              ["drawer", t.sim.eventTabDrawer],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={eventTab === tab}
              className={`sim-event-tab ${eventTab === tab ? "active" : ""}`}
              onClick={() => setEventTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>
        {filteredEvents.length === 0 ? (
          <div className="sim-events-empty">{t.sim.eventsEmpty}</div>
        ) : (
          <ul className="sim-events-list">
            {filteredEvents.map((ev) => {
              const eventSource = formatEventSource(ev.sourceIp);
              return (
                <li key={ev.id} className={`sim-event sim-event--${ev.kind}`}>
                  <span className="sim-event-time">{formatEventTime(ev.at)}</span>
                  <span className="sim-event-kind">{t.sim.eventKinds[ev.kind]}</span>
                  <span className="sim-event-detail">{ev.detail}</span>
                  {ev.pollByte != null && (
                    <span className="sim-event-poll-byte" title={t.sim.pollByte}>
                      {formatPollByte(ev.pollByte)}
                      {ev.pollN != null && <span className="sim-event-poll-n">n={ev.pollN}</span>}
                    </span>
                  )}
                  {ev.durationMs != null && (
                    <span className="sim-event-duration">{formatDuration(ev.durationMs)}</span>
                  )}
                  {eventSource && <span className="sim-event-ip">{eventSource}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && <p className="sim-error">{error}</p>}
    </div>
  );
}
