import type { StoredJob } from "../App";
import { payloadHasRaster } from "@virt-printer/escpos";
import { formatLabelSize, isTsplPayload, parseTspl } from "@virt-printer/tspl";
import { useLocale } from "../i18n/context";
import type { Locale } from "../i18n/types";

interface Props {
  jobs: StoredJob[];
  selectedId: string | null;
  hubId: string;
  onSelect: (id: string) => void;
}

function formatTime(ts: number, locale: Locale): string {
  const tag = locale === "zh" ? "zh-CN" : "en-US";
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return d.toLocaleTimeString(tag, { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  return d.toLocaleString(tag, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PrintHistory({ jobs, selectedId, onSelect }: Props) {
  const { t, locale, format } = useLocale();

  function jobTitle(job: StoredJob): string {
    if (job.protocol === "tspl" || isTsplPayload(job.payload)) {
      const size = formatLabelSize(parseTspl(job.payload).commands) ?? job.labelSize;
      return size ? format(t.history.labelWithSize, { size }) : t.history.label;
    }
    if (job.protocol === "escpos" && payloadHasRaster(job.payload)) {
      return t.history.receiptWithImage;
    }
    return t.history.receipt;
  }

  if (jobs.length === 0) {
    return (
      <div className="empty">
        {t.history.empty}
        <br />
        <span className="empty-hint">{t.history.emptyHint}</span>
      </div>
    );
  }

  return (
    <ul className="history-list">
      {jobs.map((job) => (
        <li key={job.id}>
          <button
            type="button"
            className={`history-item ${job.id === selectedId ? "active" : ""}`}
            onClick={() => onSelect(job.id)}
          >
            <div className="history-head">
              <span className={`tag ${job.protocol === "tspl" || isTsplPayload(job.payload) ? "tspl" : job.protocol}`}>
                {(job.protocol === "tspl" || isTsplPayload(job.payload) ? "tspl" : job.protocol).toUpperCase()}
              </span>
              <span className="history-time">{formatTime(job.receivedAt, locale)}</span>
            </div>
            <div className="history-title">{jobTitle(job)}</div>
            <div className="history-foot">
              <span className="history-size">{formatSize(job.byteLength)}</span>
              <span className="history-ip">{job.sourceIp}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
