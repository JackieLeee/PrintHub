import { useEffect, useMemo, useRef, useState } from "react";
import type { StoredJob } from "../App";
import { isTsplPayload } from "@virt-printer/tspl";
import { useLocale } from "../i18n/context";
import {
  copyText,
  defaultPayloadFilename,
  downloadPayload,
  payloadToBase64,
  payloadToCommands,
  payloadCommandsAreRoundTrip,
  payloadToHexCompact,
} from "../lib/payload-export";
import {
  MirrorHorizontalIcon,
  MirrorVerticalIcon,
  ResetViewIcon,
  RotateLeftIcon,
  RotateRightIcon,
} from "./PreviewViewIcons";

interface Props {
  job: StoredJob | null;
  imageDataUrl?: string | null;
  paperWidth?: number;
  labelSize?: string | null;
  canvas?: HTMLCanvasElement | null;
  warnings?: string[];
}

interface PreviewViewTransform {
  rotation: 0 | 90 | 180 | 270;
  mirrorH: boolean;
  mirrorV: boolean;
}

const DEFAULT_VIEW: PreviewViewTransform = {
  rotation: 0,
  mirrorH: false,
  mirrorV: false,
};

function previewTransformStyle(view: PreviewViewTransform): string | undefined {
  const parts: string[] = [];
  if (view.rotation) parts.push(`rotate(${view.rotation}deg)`);
  if (view.mirrorH) parts.push("scaleX(-1)");
  if (view.mirrorV) parts.push("scaleY(-1)");
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export function PreviewPanel({
  job,
  imageDataUrl = null,
  paperWidth,
  labelSize = null,
  canvas = null,
  warnings = [],
}: Props) {
  const { t, format } = useLocale();
  const previewHostRef = useRef<HTMLDivElement>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [view, setView] = useState<PreviewViewTransform>(DEFAULT_VIEW);

  useEffect(() => {
    setExportMsg(null);
    setView(DEFAULT_VIEW);
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

  const viewStyle = useMemo(() => previewTransformStyle(view), [view]);
  const viewAdjusted = view.rotation !== 0 || view.mirrorH || view.mirrorV;

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

  async function onCopyCommands() {
    try {
      const text = payloadToCommands(job!.payload);
      await copyText(text);
      setExportMsg(
        payloadCommandsAreRoundTrip(job!.payload) ? t.export.copiedCommands : t.export.copiedCommandsPartial,
      );
    } catch {
      setExportMsg(t.export.copyFailed);
    }
  }

  function onDownload() {
    downloadPayload(job!.payload, filename);
    setExportMsg(t.export.downloaded);
  }

  const protocol = job.protocol === "tspl" || isTsplPayload(job.payload) ? "tspl" : job.protocol;

  return (
    <div className="preview-wrap">
      <div className="preview-meta">
        <span className={`tag ${protocol}`}>{protocol.toUpperCase()}</span>
        <span>{job.sourceIp}</span>
        <span>{job.byteLength} bytes</span>
        {paperWidth != null && protocol === "escpos" && (
          <span className="preview-paper">{format(t.preview.paperWidth, { n: paperWidth })}</span>
        )}
        {labelSize != null && protocol === "tspl" && (
          <span className="preview-paper">{format(t.preview.labelSize, { size: labelSize })}</span>
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
        <button type="button" className="btn-sm" onClick={() => void onCopyCommands()}>
          {t.export.copyCommands}
        </button>
        {exportMsg && <span className="export-msg">{exportMsg}</span>}
      </div>

      {previewReady && (
        <div className="preview-view-toolbar">
          <button
            type="button"
            className="btn-sm btn-icon"
            title={t.preview.rotateLeft}
            aria-label={t.preview.rotateLeft}
            onClick={() =>
              setView((v) => ({ ...v, rotation: ((v.rotation + 270) % 360) as PreviewViewTransform["rotation"] }))
            }
          >
            <RotateLeftIcon />
          </button>
          <button
            type="button"
            className="btn-sm btn-icon"
            title={t.preview.rotateRight}
            aria-label={t.preview.rotateRight}
            onClick={() =>
              setView((v) => ({ ...v, rotation: ((v.rotation + 90) % 360) as PreviewViewTransform["rotation"] }))
            }
          >
            <RotateRightIcon />
          </button>
          <button
            type="button"
            className={`btn-sm btn-icon${view.mirrorH ? " active" : ""}`}
            title={t.preview.mirrorH}
            aria-label={t.preview.mirrorH}
            onClick={() => setView((v) => ({ ...v, mirrorH: !v.mirrorH }))}
          >
            <MirrorHorizontalIcon />
          </button>
          <button
            type="button"
            className={`btn-sm btn-icon${view.mirrorV ? " active" : ""}`}
            title={t.preview.mirrorV}
            aria-label={t.preview.mirrorV}
            onClick={() => setView((v) => ({ ...v, mirrorV: !v.mirrorV }))}
          >
            <MirrorVerticalIcon />
          </button>
          <button
            type="button"
            className="btn-sm btn-icon-text"
            disabled={!viewAdjusted}
            title={t.preview.resetView}
            aria-label={t.preview.resetView}
            onClick={() => setView(DEFAULT_VIEW)}
          >
            <ResetViewIcon />
            <span>{t.preview.resetView}</span>
          </button>
        </div>
      )}

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
      <div className={`preview-mount${viewAdjusted ? " preview-mount--transformed" : ""}`}>
        <div
          ref={previewHostRef}
          className="preview-host preview-view-inner"
          style={viewStyle ? { transform: viewStyle } : undefined}
        />
        {!previewReady && <div className="preview-loading">{t.preview.rendering}</div>}
      </div>
    </div>
  );
}
