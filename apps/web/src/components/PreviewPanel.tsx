import { useEffect, useRef, useState } from "react";
import type { StoredJob } from "../App";
import { useLocale } from "../i18n/context";
import {
  copyText,
  defaultPayloadFilename,
  downloadPayload,
  payloadToBase64,
  payloadToHexCompact,
} from "../lib/payload-export";

interface Props {
  job: StoredJob | null;
  imageDataUrl?: string | null;
  paperWidth?: number;
  canvas?: HTMLCanvasElement | null;
  warnings?: string[];
}

export function PreviewPanel({
  job,
  imageDataUrl = null,
  paperWidth,
  canvas = null,
  warnings = [],
}: Props) {
  const { t, format } = useLocale();
  const previewHostRef = useRef<HTMLDivElement>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  useEffect(() => {
    setExportMsg(null);
  }, [job?.id]);

  useEffect(() => {
    const host = previewHostRef.current;
    if (!host || !job) return;

    host.replaceChildren();

    if (imageDataUrl) {
      const shell = document.createElement("div");
      shell.className = "receipt-shell";
      const img = document.createElement("img");
      img.src = imageDataUrl;
      img.alt = "Receipt preview";
      img.className = "receipt-image";
      shell.appendChild(img);
      host.appendChild(shell);
      return;
    }

    if (canvas) {
      const wrap = document.createElement("div");
      wrap.className = "tspl-preview-mount";
      canvas.className = "preview-canvas";
      wrap.appendChild(canvas);
      host.appendChild(wrap);
    }
  }, [job, job?.id, imageDataUrl, canvas]);

  if (!job) {
    return <div className="empty">{t.preview.empty}</div>;
  }

  const filename = defaultPayloadFilename(job.protocol, job.id);
  const previewReady = Boolean(imageDataUrl || canvas);

  async function onCopyHex() {
    try {
      await copyText(payloadToHexCompact(job!.payload));
      setExportMsg(t.export.copiedHex);
    } catch {
      setExportMsg(t.export.copyFailed);
    }
  }

  async function onCopyBase64() {
    try {
      await copyText(payloadToBase64(job!.payload));
      setExportMsg(t.export.copiedBase64);
    } catch {
      setExportMsg(t.export.copyFailed);
    }
  }

  function onDownload() {
    downloadPayload(job!.payload, filename);
    setExportMsg(t.export.downloaded);
  }

  return (
    <div className="preview-wrap">
      <div className="preview-meta">
        <span className={`tag ${job.protocol}`}>{job.protocol.toUpperCase()}</span>
        <span>{job.sourceIp}</span>
        <span>{job.byteLength} bytes</span>
        {paperWidth != null && job.protocol === "escpos" && (
          <span className="preview-paper">{format(t.preview.paperWidth, { n: paperWidth })}</span>
        )}
      </div>

      <div className="export-toolbar">
        <button type="button" className="btn-sm" onClick={onDownload}>
          {t.export.download}
        </button>
        <button type="button" className="btn-sm" onClick={() => void onCopyHex()}>
          {t.export.copyHex}
        </button>
        <button type="button" className="btn-sm" onClick={() => void onCopyBase64()}>
          {t.export.copyBase64}
        </button>
        {exportMsg && <span className="export-msg">{exportMsg}</span>}
      </div>

      {warnings.length > 0 && (
        <details className="parse-warnings">
          <summary>{format(t.preview.warnings, { n: warnings.length })}</summary>
          <ul>
            {warnings.map((w, i) => (
              <li key={`${i}-${w.slice(0, 24)}`}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="preview-mount">
        <div ref={previewHostRef} className="preview-host" />
        {!previewReady && <div className="preview-loading">{t.preview.rendering}</div>}
      </div>
    </div>
  );
}
