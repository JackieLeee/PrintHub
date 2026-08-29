import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HubStatus, PrintJobMeta, PrinterSimConfig, PrinterSimEvent } from "@virt-printer/shared";
import { DEFAULT_TCP_PORT, hubIdFromStatus } from "@virt-printer/shared";
import { RelayClient } from "@virt-printer/relay-client";
import { DesktopRelayClient } from "./lib/desktop-relay-client";
import { isDesktopApp, isDesktopShell } from "./lib/is-desktop";
import { applyDesktopChrome } from "./lib/desktop-chrome";
import { DesktopTrafficLights } from "./components/DesktopTrafficLights";
import { isMeaningfulPrintJob } from "@virt-printer/escpos";
import { parseTspl, formatLabelSize, isTsplPayload } from "@virt-printer/tspl";
import { renderEscPosPreview, renderTsplToCanvas } from "@virt-printer/renderer";
import { AppHeaderActions } from "./components/AppHeaderActions";
import { ToastHost } from "./components/ToastHost";
import { PrintHistory } from "./components/PrintHistory";
import { PreviewPanel } from "./components/PreviewPanel";
import { WorkbenchPanel, type WorkbenchRightTab } from "./components/WorkbenchPanel";
import { createLocalJobMeta, LOCAL_HUB_ID } from "./lib/local-job";
import { prependSimEvent } from "./lib/local-sim";
import { clearJobs, flushHistory, loadJobs, recordToJob, saveJob } from "./store/history";
import { clearSimEvents } from "./lib/printer-sim-api";
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
  const [workbenchOpen, setWorkbenchOpen] = useState(true);
  const [rightTab, setRightTab] = useState<WorkbenchRightTab>("network");
  const clientRef = useRef<RelayClient | DesktopRelayClient | null>(null);
  const activeHubIdRef = useRef<string>("");
  const desktopShell = isDesktopShell();
  const [ipcReady, setIpcReady] = useState(() => isDesktopApp());
  const desktopMode = desktopShell && ipcReady;

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

  const handleClearSimEvents = useCallback(async () => {
    try {
      await clearSimEvents(httpBase);
      setStatus((prev) => (prev ? { ...prev, simEvents: [] } : prev));
    } catch {
      /* bridge offline — local clear only */
      setStatus((prev) => (prev ? { ...prev, simEvents: [] } : prev));
    }
  }, [httpBase]);

  const handleClearHistory = useCallback(async () => {
    if (!window.confirm(t.history.clearConfirm)) return;
    const hubIds = new Set([activeHubIdRef.current || LOCAL_HUB_ID, LOCAL_HUB_ID]);
    for (const hubId of hubIds) {
      await clearJobs(hubId);
    }
    setJobs([]);
    setSelectedId(null);
  }, [t.history.clearConfirm]);

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

    if (desktopMode) {
      const client = new DesktopRelayClient({
        onOpen: () => setConnected(true),
        onClose: () => {
          setConnected(false);
          setStatus(null);
        },
        onError: () => setConnected(false),
        onStatus: (next) => {
          setStatus(next);
          setConnected(true);
        },
        onJob: addJob,
        onMessage: (msg) => {
          if (msg.type === "sim.event") applySimEvent(msg.event);
        },
      });
      clientRef.current = client;
      client.connect();
      return;
    }

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
  }, [wsUrl, addJob, applySimEvent, desktopMode]);

  useEffect(() => {
    if (!desktopMode) return;
    const pull = () => {
      void window.printhubDesktop?.getBridgeStatus().then((next) => {
        if (next) {
          setStatus(next);
          setConnected(true);
        }
      });
    };
    pull();
    const timer = window.setInterval(pull, 3000);
    return () => window.clearInterval(timer);
  }, [desktopMode, status?.httpPort, status?.hubInstanceId]);

  useEffect(() => {
    if (!desktopShell || ipcReady) return;
    const id = window.setInterval(() => {
      if (isDesktopApp()) {
        setIpcReady(true);
        window.clearInterval(id);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [desktopShell, ipcReady]);

  useEffect(() => {
    if (desktopShell && !ipcReady) return;
    connect();
    return () => {
      clientRef.current?.disconnect();
      void flushHistory();
    };
  }, [connect, desktopShell, ipcReady]);

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

  useEffect(() => {
    applyDesktopChrome();
  }, [ipcReady]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setWorkbenchOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={`app app--preview-first${desktopShell ? " app--desktop-shell" : ""}`}>
      <ToastHost />
      <header className="header">
        <DesktopTrafficLights />
        <div className="header-brand">
          <h1>{t.app.title}</h1>
          {!desktopShell && (
            <p className="subtitle">
              {hostIp
                ? format(t.app.subtitle, { host: hostIp, tcp: tcpPort })
                : t.app.subtitleOffline}
            </p>
          )}
        </div>
        <AppHeaderActions
          historyLoading={!historyReady && !desktopShell}
          loadingLabel={t.app.loadingHistory}
          compact={desktopShell}
        />
      </header>

      <WorkbenchPanel
        open={workbenchOpen}
        onOpenChange={setWorkbenchOpen}
        rightTab={rightTab}
        onRightTabChange={setRightTab}
        status={status}
        connected={connected}
        desktopMode={desktopMode}
        wsUrl={wsUrl}
        bridgeInput={bridgeInput}
        showBridgeSetup={!desktopMode && (isExternalDemoHost() || (!connected && !isBridgeOrigin()))}
        lanUiUrl={
          desktopMode
            ? status?.httpPort && status.httpPort > 0 && status.hostIp
              ? lanUiUrl(status.hostIp, status.httpPort)
              : null
            : hostIp && status?.httpPort
              ? lanUiUrl(hostIp, status.httpPort)
              : null
        }
        httpBase={httpBase}
        onBridgeInputChange={setBridgeInput}
        onConnectBridge={() => connectBridge()}
        onReconnect={connect}
        onPreview={previewLocalJob}
        onSimConfigChange={applySimConfig}
        onSimEventsClear={() => void handleClearSimEvents()}
      />

      <div className="preview-stage">
        <main className="preview-primary panel">
          <PreviewPanel
            job={selectedJob}
            imageDataUrl={preview.imageDataUrl}
            paperWidth={preview.paperWidth}
            labelSize={preview.labelSize}
            canvas={preview.canvas}
            warnings={preview.warnings}
            receiptFontId={receiptFontId}
          />
        </main>

        <aside className="history-sidebar panel">
          <div className="history-sidebar-head">
            <h2>{t.sections.history}</h2>
            <div className="history-sidebar-head-actions">
              <span className="history-count">{format(t.history.totalCount, { n: visibleJobs.length })}</span>
              <button
                type="button"
                className="btn-sm btn-ghost"
                disabled={visibleJobs.length === 0}
                onClick={() => void handleClearHistory()}
              >
                {t.history.clear}
              </button>
            </div>
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
