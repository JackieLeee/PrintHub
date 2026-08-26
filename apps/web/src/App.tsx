import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HubStatus, PrintJobMeta } from "@virt-printer/shared";
import { DEFAULT_TCP_PORT, hubIdFromStatus } from "@virt-printer/shared";
import { RelayClient } from "@virt-printer/relay-client";
import { isMeaningfulPrintJob } from "@virt-printer/escpos";
import { parseTspl } from "@virt-printer/tspl";
import { renderEscPosPreview, renderTsplToCanvas } from "@virt-printer/renderer";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { NetworkPanel } from "./components/NetworkPanel";
import { PrintHistory } from "./components/PrintHistory";
import { PreviewPanel } from "./components/PreviewPanel";
import { RawPrintPanel } from "./components/RawPrintPanel";
import { hubFromWsUrl } from "./lib/discovery";
import { flushHistory, loadJobs, recordToJob, saveJob } from "./store/history";
import { useLocale } from "./i18n/context";

export interface StoredJob extends PrintJobMeta {
  payload: Uint8Array;
  hubId: string;
}

function initialWsUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const override = params.get("ws");
  if (override) return override;

  if (import.meta.env.DEV) {
    const host = window.location.hostname === "localhost" ? "localhost" : window.location.hostname;
    return `ws://${host}:8081`;
  }

  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}`;
}

export function App() {
  const { t, format } = useLocale();
  const [wsUrl] = useState(initialWsUrl);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<HubStatus | null>(null);
  const [jobs, setJobs] = useState<StoredJob[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const clientRef = useRef<RelayClient | null>(null);
  const activeHubIdRef = useRef<string>("");

  const activeHubId = status ? hubIdFromStatus(status) : hubFromWsUrl(wsUrl).id;

  const reloadHistory = useCallback(async (hubId: string) => {
    const records = await loadJobs(hubId);
    const loaded = records.map((r) => {
      const { meta, payload } = recordToJob(r);
      return { ...meta, payload, hubId: r.hubId };
    });
    setJobs(loaded);
    setSelectedId(loaded[0]?.id ?? null);
  }, []);

  useEffect(() => {
    loadJobs(activeHubId)
      .then((records) => {
        const loaded = records.map((r) => {
          const { meta, payload } = recordToJob(r);
          return { ...meta, payload, hubId: r.hubId };
        });
        setJobs(loaded);
        if (loaded[0]) setSelectedId(loaded[0].id);
      })
      .finally(() => setHistoryReady(true));
  }, [activeHubId]);

  useEffect(() => {
    activeHubIdRef.current = activeHubId;
  }, [activeHubId]);

  const addJob = useCallback((meta: PrintJobMeta, payload: Uint8Array) => {
    const hubId = activeHubIdRef.current || meta.hubId || "unknown";
    const enriched = { ...meta, hubId };
    setJobs((prev) => {
      const next = [{ ...enriched, payload }, ...prev.filter((j) => j.id !== meta.id)];
      return next;
    });
    setSelectedId(meta.id);
    void saveJob(enriched, payload, hubId);
  }, []);

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
    });
    clientRef.current = client;
    client.connect();
  }, [wsUrl, addJob]);

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
  }, [connected, status, reloadHistory]);

  const visibleJobs = useMemo(
    () => jobs.filter((j) => isMeaningfulPrintJob(j.payload, j.protocol)),
    [jobs],
  );

  const selectedJob = useMemo(
    () => visibleJobs.find((j) => j.id === selectedId) ?? null,
    [visibleJobs, selectedId],
  );

  const [preview, setPreview] = useState<{
    imageDataUrl: string | null;
    paperWidth: number;
    canvas: HTMLCanvasElement | null;
    warnings: string[];
  }>({
    imageDataUrl: null,
    paperWidth: 384,
    canvas: null,
    warnings: [],
  });

  useEffect(() => {
    if (!selectedJob) {
      setPreview({ imageDataUrl: null, paperWidth: 384, canvas: null, warnings: [] });
      return;
    }
    if (selectedJob.protocol === "tspl") {
      const parsed = parseTspl(selectedJob.payload);
      setPreview({
        imageDataUrl: null,
        paperWidth: 384,
        canvas: renderTsplToCanvas(parsed.commands),
        warnings: parsed.warnings,
      });
      return;
    }

    setPreview({ imageDataUrl: null, paperWidth: 384, canvas: null, warnings: [] });

    let cancelled = false;
    void renderEscPosPreview(selectedJob.payload).then((result) => {
      if (!cancelled) {
        setPreview({
          imageDataUrl: result.imageDataUrl,
          paperWidth: result.paperWidth,
          canvas: null,
          warnings: result.warnings,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedJob]);

  const tcpPort = status?.tcpPort ?? DEFAULT_TCP_PORT;
  const hostIp = status?.hostIp;

  return (
    <div className="app">
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
          <LanguageSwitcher />
          {!historyReady && <span className="badge">{t.app.loadingHistory}</span>}
        </div>
      </header>

      <section className="top-section">
        <div className="top-bar">
          <div className="panel top-panel">
            <h2>{t.sections.network}</h2>
            <NetworkPanel status={status} connected={connected} wsUrl={wsUrl} onReconnect={connect} />
          </div>

          <div className="panel debug-top-panel top-panel">
            <h2>{t.sections.debugPrint}</h2>
            <p className="debug-top-hint">{t.sections.debugPrintHint}</p>
            <RawPrintPanel status={status} />
          </div>
        </div>
      </section>

      <div className="main-split">
        <aside className="panel history-panel">
          <h2>{t.sections.history}</h2>
          <PrintHistory jobs={visibleJobs} selectedId={selectedId} onSelect={setSelectedId} hubId={activeHubId} />
        </aside>

        <section className="panel preview-panel">
          <h2>{t.sections.preview}</h2>
          <PreviewPanel
            job={selectedJob}
            imageDataUrl={preview.imageDataUrl}
            paperWidth={preview.paperWidth}
            canvas={preview.canvas}
            warnings={preview.warnings}
          />
        </section>
      </div>
    </div>
  );
}
