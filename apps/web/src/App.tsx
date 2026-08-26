import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HubInfo, HubStatus, PrintJobMeta } from "@virt-printer/shared";
import { hubIdFromStatus, hubInfoFromStatus } from "@virt-printer/shared";
import { RelayClient } from "@virt-printer/relay-client";
import { isMeaningfulPrintJob } from "@virt-printer/escpos";
import { parseTspl } from "@virt-printer/tspl";
import { renderEscPosPreview, renderTsplToCanvas } from "@virt-printer/renderer";
import { NetworkPanel } from "./components/NetworkPanel";
import { PrintHistory } from "./components/PrintHistory";
import { PreviewPanel } from "./components/PreviewPanel";
import { HubSelector } from "./components/HubSelector";
import { RawPrintPanel } from "./components/RawPrintPanel";
import { discoverHubs, hubFromWsUrl } from "./lib/discovery";
import {
  adaptHubForClient,
  loadRecentHubs,
  loadSelectedHubId,
  mergeHubLists,
  preferLocalWsUrl,
  rememberHub,
  saveSelectedHubId,
} from "./lib/hub-storage";
import { flushHistory, loadJobs, recordToJob, saveJob } from "./store/history";

export interface StoredJob extends PrintJobMeta {
  payload: Uint8Array;
  hubId: string;
}

function initialWsUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const override = params.get("ws");
  if (override) return override;
  const recent = loadRecentHubs()[0];
  if (recent) return preferLocalWsUrl(recent.wsUrl);
  const host = window.location.hostname === "localhost" ? "localhost" : window.location.hostname;
  return `ws://${host}:8080`;
}

export function App() {
  const [wsUrl, setWsUrl] = useState(initialWsUrl);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<HubStatus | null>(null);
  const [jobs, setJobs] = useState<StoredJob[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [hubs, setHubs] = useState<HubInfo[]>(() => loadRecentHubs());
  const [selectedHubId, setSelectedHubId] = useState<string | null>(() => loadSelectedHubId());
  const [scanning, setScanning] = useState(false);
  const clientRef = useRef<RelayClient | null>(null);
  const activeHubIdRef = useRef<string>("");

  const activeHubId = status ? hubIdFromStatus(status) : selectedHubId ?? hubFromWsUrl(wsUrl).id;

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
    const hubId = selectedHubId ?? hubFromWsUrl(wsUrl).id;
    loadJobs(hubId)
      .then((records) => {
        const loaded = records.map((r) => {
          const { meta, payload } = recordToJob(r);
          return { ...meta, payload, hubId: r.hubId };
        });
        setJobs(loaded);
        if (loaded[0]) setSelectedId(loaded[0].id);
      })
      .finally(() => setHistoryReady(true));
  }, [selectedHubId, wsUrl]);

  useEffect(() => {
    activeHubIdRef.current = activeHubId;
  }, [activeHubId]);

  const addJob = useCallback(
    (meta: PrintJobMeta, payload: Uint8Array) => {
      const hubId = activeHubIdRef.current || meta.hubId || "unknown";
      const enriched = { ...meta, hubId };
      setJobs((prev) => {
        const next = [{ ...enriched, payload }, ...prev.filter((j) => j.id !== meta.id)];
        return next;
      });
      setSelectedId(meta.id);
      void saveJob(enriched, payload, hubId);
    },
    [],
  );

  const connect = useCallback(() => {
    clientRef.current?.disconnect();
    const url = preferLocalWsUrl(wsUrl);
    const client = new RelayClient(url, {
      onOpen: () => setConnected(true),
      onClose: () => {
        setConnected(false);
        setStatus(null);
      },
      onError: () => setConnected(false),
      onStatus: (s) => {
        setStatus(s);
        const hub = adaptHubForClient(hubInfoFromStatus(s, "scan"));
        setHubs((prev) => {
          const merged = mergeHubLists([hub], prev);
          return merged;
        });
        setSelectedHubId((prevId) => {
          if (!prevId || prevId.startsWith("pending:") || prevId === hub.id) {
            saveSelectedHubId(hub.id);
            return hub.id;
          }
          return prevId;
        });
        rememberHub(hub);
      },
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
    const hubId = hubIdFromStatus(status);
    if (hubId !== selectedHubId) return;
    void reloadHistory(hubId);
  }, [connected, status, selectedHubId, reloadHistory]);

  const selectHub = useCallback(
    (hub: HubInfo) => {
      const normalized = adaptHubForClient(hub);
      setSelectedHubId(normalized.id);
      saveSelectedHubId(normalized.id);
      const nextUrl = preferLocalWsUrl(normalized.wsUrl);
      if (nextUrl !== wsUrl) {
        setWsUrl(nextUrl);
      } else {
        connect();
      }
      rememberHub(normalized);
      setHubs((prev) => mergeHubLists([normalized], prev));
      void reloadHistory(normalized.id);
    },
    [reloadHistory, wsUrl, connect],
  );

  const scanHubs = useCallback(async () => {
    setScanning(true);
    try {
      const found = await discoverHubs({ extraIps: ["127.0.0.1"] });
      const adapted = found.map(adaptHubForClient);
      setHubs((prev) => mergeHubLists(adapted, prev, loadRecentHubs()));
      if (adapted[0] && !selectedHubId) selectHub(adapted[0]);
    } finally {
      setScanning(false);
    }
  }, [selectHub, selectedHubId]);

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

  const currentHub = hubs.find((h) => h.id === (selectedHubId ?? activeHubId));

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>virt-printer-hub</h1>
          <p className="subtitle">
            虚拟打印机 · {currentHub ? currentHub.hostIp : "未选择 Hub"}
          </p>
        </div>
        <div className="header-actions">
          {!historyReady && <span className="badge">加载历史…</span>}
        </div>
      </header>

      <section className="top-bar">
        <div className="panel top-panel">
          <h2>Hub 选择</h2>
          <HubSelector
            hubs={hubs}
            selectedHubId={selectedHubId ?? activeHubId}
            wsUrl={wsUrl}
            connected={connected}
            scanning={scanning}
            onScan={() => void scanHubs()}
            onSelectHub={selectHub}
            onWsUrlChange={setWsUrl}
            onConnect={connect}
          />
        </div>
        <div className="panel top-panel">
          <h2>网络与端口</h2>
          <NetworkPanel status={status} connected={connected} wsUrl={wsUrl} />
        </div>
      </section>

      <div className="main-split">
        <aside className="panel history-panel">
          <h2>打印历史</h2>
          <PrintHistory jobs={visibleJobs} selectedId={selectedId} onSelect={setSelectedId} hubId={activeHubId} />
        </aside>

        <section className="panel preview-panel">
          <h2>预览</h2>
          <PreviewPanel
            job={selectedJob}
            imageDataUrl={preview.imageDataUrl}
            paperWidth={preview.paperWidth}
            canvas={preview.canvas}
            warnings={preview.warnings}
          />
        </section>
      </div>

      <details className="debug-section">
        <summary>调试打印 · File / Hex / Base64</summary>
        <div className="panel debug-panel">
          <RawPrintPanel status={status} />
        </div>
      </details>
    </div>
  );
}
