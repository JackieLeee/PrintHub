import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HubStatus, PrintJobMeta, PrinterSimConfig, PrinterSimEvent } from "@virt-printer/shared";
import { DEFAULT_TCP_PORT, hubIdFromStatus } from "@virt-printer/shared";
import { RelayClient } from "@virt-printer/relay-client";
import { isMeaningfulPrintJob } from "@virt-printer/escpos";
import { parseTspl, formatLabelSize, isTsplPayload } from "@virt-printer/tspl";
import { renderEscPosPreview, renderTsplToCanvas } from "@virt-printer/renderer";
import { GithubLink } from "./components/GithubLink";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { NetworkPanel } from "./components/NetworkPanel";
import { PrintHistory } from "./components/PrintHistory";
import { PreviewPanel } from "./components/PreviewPanel";
import { RawPrintPanel } from "./components/RawPrintPanel";
import { PrinterSimPanel } from "./components/PrinterSimPanel";
import { createLocalJobMeta, LOCAL_HUB_ID } from "./lib/local-job";
import { prependSimEvent } from "./lib/local-sim";
import { flushHistory, loadJobs, recordToJob, saveJob } from "./store/history";
import { useLocale } from "./i18n/context";
import {
  bridgeBaseToWsUrl,
  isBridgeOrigin,
  isExternalDemoHost,
  lanUiUrl,
  loadBridgeBase,
  normalizeBridgeBase,
  resolveBridgeWsUrl,
  saveBridgeBase,
  resolveHttpBaseFromBridge,
} from "./lib/bridge-url";
import { loadReceiptFontId } from "./lib/receipt-font-preference";

export interface StoredJob extends PrintJobMeta {
  payload: Uint8Array;
  hubId: string;
}

function initialWsUrl(): string {
  return resolveBridgeWsUrl();
}

export function App() {
  const { t, format } = useLocale();
  const [wsUrl, setWsUrl] = useState(initialWsUrl);
  const [bridgeInput, setBridgeInput] = useState(() => loadBridgeBase()?.replace(/^https?:\/\//, "") ?? "");
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<HubStatus | null>(null);
  const [jobs, setJobs] = useState<StoredJob[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [openPanel, setOpenPanel] = useState<"network" | "debug" | null>("network");
  const [cmdRefOpen, setCmdRefOpen] = useState(false);
  const clientRef = useRef<RelayClient | null>(null);
  const activeHubIdRef = useRef<string>("");

  const activeHubId = status ? hubIdFromStatus(status) : LOCAL_HUB_ID;

  const httpBase = useMemo(
    () => resolveHttpBaseFromBridge(status?.hostIp ?? null),
    [status?.hostIp],
  );

  const applySimConfig = useCallback((config: PrinterSimConfig) => {
    setStatus((prev) => (prev ? { ...prev, printerSim: config } : prev));
  }, []);

  const applySimEvent = useCallback((event: PrinterSimEvent) => {
    setStatus((prev) =>
      prev
        ? { ...prev, simEvents: prependSimEvent(prev.simEvents, event) }
        : prev,
    );
  }, []);

  const reloadHistory = useCallback(async (hubId: string) => {
    const hubRecords = await loadJobs(hubId);
    const localRecords = hubId !== LOCAL_HUB_ID ? await loadJobs(LOCAL_HUB_ID) : [];
    const byId = new Map<string, StoredJob>();
    for (const r of [...localRecords, ...hubRecords]) {
      const { meta, payload } = recordToJob(r);
      byId.set(meta.id, { ...meta, payload, hubId: r.hubId });
    }
    const loaded = [...byId.values()].sort((a, b) => b.receivedAt - a.receivedAt);
    setJobs(loaded);
    setSelectedId((prev) => (prev && loaded.some((j) => j.id === prev) ? prev : (loaded[0]?.id ?? null)));
  }, []);

  useEffect(() => {
    void reloadHistory(activeHubId).finally(() => setHistoryReady(true));
  }, [activeHubId, reloadHistory]);

  useEffect(() => {
    activeHubIdRef.current = activeHubId;
  }, [activeHubId]);

  const addJob = useCallback((meta: PrintJobMeta, payload: Uint8Array) => {
    const hubId =
      meta.source === "debug"
        ? LOCAL_HUB_ID
        : activeHubIdRef.current || meta.hubId || "unknown";
    const protocol =
      meta.protocol === "tspl" || isTsplPayload(payload) ? "tspl" : meta.protocol;
    const labelSize =
      protocol === "tspl"
        ? formatLabelSize(parseTspl(payload).commands) ?? meta.labelSize
        : meta.labelSize;
    const enriched = { ...meta, hubId, protocol, labelSize };
    setJobs((prev) => {
      const next = [{ ...enriched, payload }, ...prev.filter((j) => j.id !== meta.id)];
      return next;
    });
    setSelectedId(meta.id);
    void saveJob(enriched, payload, hubId);
  }, []);

  const previewLocalJob = useCallback(
    (payload: Uint8Array, label: string) => {
      const meta = createLocalJobMeta(payload, label);
      addJob(meta, payload);
    },
    [addJob],
  );

  const connectBridge = useCallback(
    (address?: string) => {
      const raw = (address ?? bridgeInput).trim();
      if (!raw) return;
      try {
        const base = normalizeBridgeBase(raw);
        saveBridgeBase(base);
        setBridgeInput(base.replace(/^https?:\/\//, ""));
        setWsUrl(bridgeBaseToWsUrl(base));
      } catch {
        /* invalid input */
      }
    },
    [bridgeInput],
  );

  const connect = useCallback(() => {
    clientRef.current?.disconnect();
    const client = new RelayClient(wsUrl, {
      onOpen: () => setConnected(true),
      onClose: () => {
        setConnected(false);
        setStatus(null);
      },
      onError: () => setConnected(false),
      onStatus: setStatus,
      onJob: addJob,
      onMessage: (msg) => {
        if (msg.type === "sim.event") applySimEvent(msg.event);
      },
    });
    clientRef.current = client;
    client.connect();
  }, [wsUrl, addJob, applySimEvent]);

  useEffect(() => {
    connect();
    return () => {
      clientRef.current?.disconnect();
      void flushHistory();
    };
  }, [connect]);

  useEffect(() => {
    if (!connected || !status) return;
    void reloadHistory(hubIdFromStatus(status));
  }, [connected, status?.hubInstanceId, reloadHistory]);

  const visibleJobs = useMemo(
    () => jobs.filter((j) => isMeaningfulPrintJob(j.payload, j.protocol)),
    [jobs],
  );

  const selectedJob = useMemo(
    () => visibleJobs.find((j) => j.id === selectedId) ?? null,
    [visibleJobs, selectedId],
  );

  const receiptFontId = loadReceiptFontId();

  const [preview, setPreview] = useState<{
    imageDataUrl: string | null;
    paperWidth: number;
    labelSize: string | null;
    canvas: HTMLCanvasElement | null;
    warnings: string[];
  }>({
    imageDataUrl: null,
    paperWidth: 384,
    labelSize: null,
    canvas: null,
    warnings: [],
  });

  useEffect(() => {
    if (!selectedJob) {
      setPreview({
        imageDataUrl: null,
        paperWidth: 384,
        labelSize: null,
        canvas: null,
        warnings: [],
      });
      return;
    }
    const tsplJob = selectedJob.protocol === "tspl" || isTsplPayload(selectedJob.payload);
    if (tsplJob) {
      const parsed = parseTspl(selectedJob.payload);
      setPreview({
        imageDataUrl: null,
        paperWidth: 384,
        labelSize: formatLabelSize(parsed.commands),
        canvas: renderTsplToCanvas(parsed.commands),
        warnings: parsed.warnings,
      });
      return;
    }

    setPreview({
      imageDataUrl: null,
      paperWidth: 384,
      labelSize: null,
      canvas: null,
      warnings: [],
    });

    let cancelled = false;
    void renderEscPosPreview(selectedJob.payload, { receiptFontId }).then((result) => {
      if (!cancelled) {
        setPreview({
          imageDataUrl: result.imageDataUrl,
          paperWidth: result.paperWidth,
          labelSize: null,
          canvas: null,
          warnings: result.warnings,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedJob, receiptFontId]);

  const tcpPort = status?.tcpPort ?? DEFAULT_TCP_PORT;
  const hostIp = status?.hostIp;

  const togglePanel = useCallback((panel: "network" | "debug") => {
    setOpenPanel((current) => {
      const next = current === panel ? null : panel;
      if (next !== "debug") setCmdRefOpen(false);
      return next;
    });
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenPanel(null);
        setCmdRefOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="app app--preview-first">
      <header className="header">
        <div>
          <h1>{t.app.title}</h1>
          <p className="subtitle">
            {hostIp
              ? format(t.app.subtitle, { host: hostIp, tcp: tcpPort })
              : t.app.subtitleOffline}
          </p>
        </div>
        <div className="header-actions">
          <GithubLink />
          <ThemeSwitcher />
          <LanguageSwitcher />
          {!historyReady && <span className="badge">{t.app.loadingHistory}</span>}
        </div>
      </header>

      <div className="toolbelt">
        <button
          type="button"
          className={`toolbelt-btn ${openPanel === "network" ? "active" : ""}`}
          aria-expanded={openPanel === "network"}
          onClick={() => togglePanel("network")}
        >
          {t.toolbelt.network} {openPanel === "network" ? "▴" : "▾"}
        </button>
        <button
          type="button"
          className={`toolbelt-btn ${openPanel === "debug" ? "active" : ""}`}
          aria-expanded={openPanel === "debug"}
          onClick={() => togglePanel("debug")}
        >
          {t.toolbelt.debug} {openPanel === "debug" ? "▴" : "▾"}
        </button>
        <span className={`pill ${connected ? "ok" : "warn"}`}>
          {connected ? t.network.bridgeOnline : t.network.waitingBridge}
        </span>
        {hostIp && (
          <span className="toolbelt-meta">
            {hostIp} · TCP {tcpPort}
          </span>
        )}
      </div>

      {openPanel === "network" && (
        <section className="toolbelt-panel panel">
          <NetworkPanel
            status={status}
            connected={connected}
            wsUrl={wsUrl}
            bridgeInput={bridgeInput}
            showBridgeSetup={isExternalDemoHost() || (!connected && !isBridgeOrigin())}
            lanUiUrl={hostIp ? lanUiUrl(hostIp, status?.httpPort) : null}
            onBridgeInputChange={setBridgeInput}
            onConnectBridge={() => connectBridge()}
            onReconnect={connect}
          />
        </section>
      )}

      {openPanel === "debug" && (
        <section className="toolbelt-panel panel debug-top-panel">
          <p className="debug-top-hint">{t.sections.debugPrintHint}</p>
          <div className={`debug-panel-split${cmdRefOpen ? " cmd-ref-open" : ""}`}>
            <div className="debug-panel-main">
              <RawPrintPanel onPreview={previewLocalJob} onCmdRefOpenChange={setCmdRefOpen} />
            </div>
            <div className="debug-panel-divider" aria-hidden="true" />
            <div className="debug-panel-sim">
              <PrinterSimPanel
                httpBase={httpBase}
                config={status?.printerSim ?? null}
                events={status?.simEvents ?? []}
                connected={connected}
                onConfigChange={applySimConfig}
              />
            </div>
          </div>
        </section>
      )}

      <div className="preview-stage">
        <main className="preview-primary panel">
          <PreviewPanel
            job={selectedJob}
            imageDataUrl={preview.imageDataUrl}
            paperWidth={preview.paperWidth}
            labelSize={preview.labelSize}
            canvas={preview.canvas}
            warnings={preview.warnings}
          />
        </main>

        <aside className="history-sidebar panel">
          <div className="history-sidebar-head">
            <h2>{t.sections.history}</h2>
            <span className="history-count">{format(t.history.totalCount, { n: visibleJobs.length })}</span>
          </div>
          <PrintHistory
            jobs={visibleJobs}
            selectedId={selectedId}
            onSelect={setSelectedId}
            hubId={activeHubId}
            variant="sidebar"
          />
        </aside>
      </div>
    </div>
  );
}
