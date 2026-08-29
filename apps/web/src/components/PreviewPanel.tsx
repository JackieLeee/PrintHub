import { useEffect, useMemo, useRef, useState } from "react";
import type { StoredJob } from "../App";
import { parseEscPosInspector, detectEscPosDialect, type EscPosDialect } from "@virt-printer/escpos";
import { isTsplPayload, parseTspl, parseLabelSizeMm } from "@virt-printer/tspl";
import { buildRenderElements, renderEscPosPreview, renderTsplToCanvas } from "@virt-printer/renderer";
import { useLocale } from "../i18n/context";
import { formatDuration } from "../lib/format-duration";
import { ExportDialog } from "./ExportDialog";
import { InspectorPanel } from "./InspectorPanel";
import type { InspectorBlock } from "../lib/inspector-blocks";
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
  receiptFontId?: string;
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
  receiptFontId,
}: Props) {
  const { t, format } = useLocale();
  const previewHostRef = useRef<HTMLDivElement>(null);
  const previewMountRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<PreviewViewTransform>(DEFAULT_VIEW);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<InspectorBlock | null>(null);
  const highlightCommandId = selectedBlock?.highlightId ?? null;
  const [linkedImageDataUrl, setLinkedImageDataUrl] = useState<string | null>(null);
  const [linkedCanvas, setLinkedCanvas] = useState<HTMLCanvasElement | null>(null);

  const protocol =
    job?.protocol === "tspl" || (job != null && isTsplPayload(job.payload)) ? "tspl" : job?.protocol ?? "escpos";

  const escPosDialect: EscPosDialect | null =
    protocol === "escpos" && job ? detectEscPosDialect(job.payload) : null;

  const labelSizeMm = useMemo(() => {
    if (!job || protocol !== "tspl") return null;
    return parseLabelSizeMm(parseTspl(job.payload).commands);
  }, [job, protocol]);

  useEffect(() => {
    setView(DEFAULT_VIEW);
    setSelectedBlock(null);
  }, [job?.id]);

  useEffect(() => {
    if (!job || !highlightCommandId) {
      setLinkedImageDataUrl(null);
      setLinkedCanvas(null);
      return;
    }

    let cancelled = false;

    if (protocol === "escpos") {
      void renderEscPosPreview(job.payload, { receiptFontId, highlightCommandId }).then((result) => {
        if (!cancelled) setLinkedImageDataUrl(result.imageDataUrl);
      });
    } else if (protocol === "tspl") {
      const parsed = parseTspl(job.payload);
      const nextCanvas = renderTsplToCanvas(parsed.commands, { highlightCommandId });
      if (!cancelled) setLinkedCanvas(nextCanvas);
    }

    return () => {
      cancelled = true;
    };
  }, [job, highlightCommandId, protocol, receiptFontId]);

  useEffect(() => {
    if (!job || !highlightCommandId || protocol !== "escpos") return;
    const width = paperWidth ?? 384;
    const { commands } = parseEscPosInspector(job.payload, width);
    const elements = buildRenderElements(commands, width);
    const element = elements.find(
      (item) =>
        item.commandId === highlightCommandId || item.mergedCommandIds?.includes(highlightCommandId),
    );
    if (element && previewMountRef.current) {
      previewMountRef.current.scrollTo({ top: Math.max(0, element.y - 24), behavior: "smooth" });
    }
  }, [job, highlightCommandId, protocol, paperWidth]);

  const displayImageDataUrl = linkedImageDataUrl ?? imageDataUrl;
  const displayCanvas = linkedCanvas ?? canvas;

  useEffect(() => {
    const host = previewHostRef.current;
    if (!host || !job) return;

    host.replaceChildren();

    if (displayImageDataUrl) {
      const shell = document.createElement("div");
      shell.className = "receipt-shell";
      const img = document.createElement("img");
      img.src = displayImageDataUrl;
      img.alt = "Receipt preview";
      img.className = "receipt-image";
      shell.appendChild(img);
      host.appendChild(shell);
      return;
    }

    if (displayCanvas) {
      const wrap = document.createElement("div");
      wrap.className = "tspl-preview-mount";
      displayCanvas.className = "preview-canvas";
      wrap.appendChild(displayCanvas);
      host.appendChild(wrap);
    }
  }, [job, job?.id, displayImageDataUrl, displayCanvas]);

  const viewStyle = useMemo(() => previewTransformStyle(view), [view]);
  const viewAdjusted = view.rotation !== 0 || view.mirrorH || view.mirrorV;

  if (!job) {
    return <div className="empty">{t.preview.empty}</div>;
  }

  const previewReady = Boolean(displayImageDataUrl || displayCanvas);

  return (
    <div className="preview-wrap">
      <div className="preview-toolbar">
        <div className="preview-meta">
          <span className={`tag ${protocol}`}>{protocol.toUpperCase()}</span>
          {escPosDialect === "star" && <span className="tag star">{t.preview.dialectStar}</span>}
          <span>{job.sourceIp}</span>
          <span>{job.byteLength} bytes</span>
          {paperWidth != null && protocol === "escpos" && (
            <span className="preview-paper">{format(t.preview.paperWidth, { n: paperWidth })}</span>
          )}
          {labelSize != null && protocol === "tspl" && (
            <span className="preview-paper">{format(t.preview.labelSize, { size: labelSize })}</span>
          )}
          {job.durationMs != null && (
            <span className="preview-duration">
              {format(t.preview.durationMs, { duration: formatDuration(job.durationMs) })}
            </span>
          )}
        </div>

        <div className="preview-toolbar-actions">
          <button type="button" className="btn-sm export-open-btn" onClick={() => setExportOpen(true)}>
            {t.export.open}
          </button>

          {previewReady && (
            <div className="segmented-toolbar segmented-toolbar--icons" role="group" aria-label={t.preview.resetView}>
              <button
                type="button"
                className="segmented-btn segmented-btn--icon"
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
                className="segmented-btn segmented-btn--icon"
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
                className={`segmented-btn segmented-btn--icon${view.mirrorH ? " active" : ""}`}
                title={t.preview.mirrorH}
                aria-label={t.preview.mirrorH}
                onClick={() => setView((v) => ({ ...v, mirrorH: !v.mirrorH }))}
              >
                <MirrorHorizontalIcon />
              </button>
              <button
                type="button"
                className={`segmented-btn segmented-btn--icon${view.mirrorV ? " active" : ""}`}
                title={t.preview.mirrorV}
                aria-label={t.preview.mirrorV}
                onClick={() => setView((v) => ({ ...v, mirrorV: !v.mirrorV }))}
              >
                <MirrorVerticalIcon />
              </button>
              <button
                type="button"
                className="segmented-btn segmented-btn--icon-text"
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
        </div>
      </div>

      {warnings.length > 0 && (
        <details className="disclosure-block parse-warnings">
          <summary>{format(t.preview.warnings, { n: warnings.length })}</summary>
          <ul>
            {warnings.map((w, i) => (
              <li key={`${i}-${w.slice(0, 24)}`}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      <InspectorPanel
        payload={job.payload}
        protocol={protocol}
        selectedBlockId={selectedBlock?.id ?? null}
        onSelectBlock={setSelectedBlock}
      />
      <div
        ref={previewMountRef}
        className={`preview-mount${viewAdjusted ? " preview-mount--transformed" : ""}${highlightCommandId ? " preview-mount--linked" : ""}`}
      >
        <div
          ref={previewHostRef}
          className="preview-host preview-view-inner"
          style={viewStyle ? { transform: viewStyle } : undefined}
        />
        {!previewReady && <div className="preview-loading">{t.preview.rendering}</div>}
      </div>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        payload={job.payload}
        protocol={protocol}
        jobId={job.id}
        imageDataUrl={displayImageDataUrl}
        canvas={displayCanvas}
        previewReady={previewReady}
        pageWidthMm={labelSizeMm?.widthMm ?? ((paperWidth ?? 384) >= 576 ? 80 : 58)}
        pageHeightMm={labelSizeMm?.heightMm}
        cropPaddingPx={protocol === "tspl" && displayCanvas ? 16 : undefined}
      />
    </div>
  );
}
