import { useEffect, useRef } from "react";
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
  variant?: "sidebar" | "rail";
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

export function PrintHistory({ jobs, selectedId, onSelect, variant = "sidebar" }: Props) {
  const { t, locale, format } = useLocale();
  const activeRef = useRef<HTMLButtonElement | null>(null);

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

  useEffect(() => {
    if (!selectedId) return;
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [selectedId, jobs.length]);

  if (jobs.length === 0) {
    return (
      <div className={variant === "rail" ? "history-rail-empty" : "empty"}>
        {t.history.empty}
        {variant === "sidebar" && (
          <>
            <br />
            <span className="empty-hint">{t.history.emptyHint}</span>
          </>
        )}
        {variant === "rail" && <span className="empty-hint">{t.history.railEmptyHint}</span>}
      </div>
    );
  }

  const listClass = variant === "rail" ? "history-rail-list" : "history-list";

  return (
    <ul className={listClass}>
      {jobs.map((job) => {
        const isActive = job.id === selectedId;
        const itemClass = variant === "rail" ? "history-rail-item" : "history-item";
        return (
          <li key={job.id}>
            <button
              ref={isActive ? activeRef : undefined}
              type="button"
              className={`${itemClass} ${isActive ? "active" : ""}`}
              onClick={() => onSelect(job.id)}
            >
              <div className="history-head">
                <span className={`tag ${job.protocol === "tspl" || isTsplPayload(job.payload) ? "tspl" : job.protocol}`}>
                  {(job.protocol === "tspl" || isTsplPayload(job.payload) ? "tspl" : job.protocol).toUpperCase()}
                </span>
                <span className="history-time">{formatTime(job.receivedAt, locale)}</span>
              </div>
              <div className="history-title">{jobTitle(job)}</div>
              {variant === "sidebar" && (
                <div className="history-foot">
                  <span className="history-size">{formatSize(job.byteLength)}</span>
                  <span className="history-ip">{job.sourceIp}</span>
                </div>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
