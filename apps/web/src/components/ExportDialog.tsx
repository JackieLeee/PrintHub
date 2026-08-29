import { useEffect, useMemo, useRef, useState } from "react";
import { isTsplPayload } from "@virt-printer/tspl";
import { useLocale } from "../i18n/context";
import { showToast } from "../lib/toast";
import {
  copyText,
  defaultPayloadFilename,
  defaultPreviewPdfFilename,
  defaultPreviewPngFilename,
  downloadCanvasPng,
  downloadDataUrl,
  downloadPayload,
  downloadPreviewPdf,
  payloadToBase64,
  payloadToCommands,
  payloadCommandsAreRoundTrip,
  payloadToHex,
  payloadToHexCompact,
} from "../lib/payload-export";

export type ExportTab = "hex" | "base64" | "commands" | "raw" | "png" | "pdf";

interface Props {
  open: boolean;
  onClose: () => void;
  payload: Uint8Array;
  protocol: string;
  jobId: string;
  imageDataUrl?: string | null;
  canvas?: HTMLCanvasElement | null;
  previewReady?: boolean;
  pageWidthMm?: number;
  pageHeightMm?: number;
  cropPaddingPx?: number;
}

const PREVIEW_HEX_LIMIT = 8192;

export function ExportDialog({
  open,
  onClose,
  payload,
  protocol,
  jobId,
  imageDataUrl = null,
  canvas = null,
  previewReady = false,
  pageWidthMm = 80,
  pageHeightMm,
  cropPaddingPx,
}: Props) {
  const { t, format } = useLocale();
  const [tab, setTab] = useState<ExportTab>("hex");
  const copyRef = useRef<HTMLButtonElement>(null);

  const resolvedProtocol = protocol === "tspl" || isTsplPayload(payload) ? "tspl" : protocol;
  const rawFilename = defaultPayloadFilename(resolvedProtocol, jobId);
  const pngFilename = defaultPreviewPngFilename(resolvedProtocol, jobId);
  const pdfFilename = defaultPreviewPdfFilename(resolvedProtocol, jobId);
  const commandsRoundTrip = payloadCommandsAreRoundTrip(payload);
  const commandsPartial = tab === "commands" && !commandsRoundTrip;

  const preview = useMemo(() => {
    switch (tab) {
      case "hex":
        return payloadToHex(payload, PREVIEW_HEX_LIMIT);
      case "base64":
        return payloadToBase64(payload);
      case "commands":
        return payloadToCommands(payload);
      case "raw":
        return format(t.exportDialog.rawDescription, {
          filename: rawFilename,
          protocol: resolvedProtocol.toUpperCase(),
          bytes: payload.length,
        });
      default:
        return "";
    }
  }, [tab, payload, rawFilename, resolvedProtocol, t.exportDialog.rawDescription, format]);

  useEffect(() => {
    if (!open) return;
    copyRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function onCopy() {
    try {
      if (tab === "hex") {
        await copyText(payloadToHexCompact(payload));
        showToast(t.export.copiedHex, "ok");
      } else if (tab === "base64") {
        await copyText(payloadToBase64(payload));
        showToast(t.export.copiedBase64, "ok");
      } else if (tab === "commands") {
        await copyText(payloadToCommands(payload));
        showToast(commandsRoundTrip ? t.export.copiedCommands : t.export.copiedCommandsPartial, "ok");
      } else if (tab === "raw") {
        await copyText(payloadToHexCompact(payload));
        showToast(t.export.copiedHex, "ok");
      }
    } catch {
      showToast(t.export.copyFailed, "err");
    }
  }

  async function onDownload() {
    if (tab === "png") {
      if (imageDataUrl) {
        downloadDataUrl(imageDataUrl, pngFilename);
      } else if (canvas) {
        downloadCanvasPng(canvas, pngFilename);
      }
      showToast(t.export.downloadedPng, "ok");
      return;
    }
    if (tab === "pdf") {
      try {
        await downloadPreviewPdf({ imageDataUrl, canvas }, pdfFilename, {
          pageWidthMm,
          pageHeightMm,
          cropPaddingPx,
        });
        showToast(t.export.downloadedPdf, "ok");
      } catch {
        showToast(t.export.downloadFailed, "err");
      }
      return;
    }
    if (tab === "hex" || tab === "base64" || tab === "commands") {
      const ext = tab === "commands" ? (resolvedProtocol === "tspl" ? "tspl" : "txt") : tab;
      const blob = new Blob([preview], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `print-${jobId.slice(0, 8)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t.export.downloaded, "ok");
      return;
    }
    downloadPayload(payload, rawFilename);
    showToast(t.export.downloaded, "ok");
  }

  const tabs: { id: ExportTab; label: string; disabled?: boolean }[] = [
    { id: "hex", label: t.exportDialog.tabHex },
    { id: "base64", label: t.exportDialog.tabBase64 },
    { id: "commands", label: t.exportDialog.tabCommands },
    { id: "raw", label: t.exportDialog.tabRaw },
    { id: "png", label: t.exportDialog.tabPng, disabled: !previewReady },
    { id: "pdf", label: t.exportDialog.tabPdf, disabled: !previewReady },
  ];

  return (
    <div className="export-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="export-dialog-header">
          <div>
            <h3 id="export-dialog-title" className="export-dialog-title">
              {t.exportDialog.title}
            </h3>
            <p className="export-dialog-subtitle">
              {format(t.exportDialog.subtitle, {
                protocol: resolvedProtocol.toUpperCase(),
                bytes: payload.length,
                filename: rawFilename,
              })}
            </p>
          </div>
          <button type="button" className="btn-sm btn-ghost export-dialog-close" onClick={onClose}>
            {t.exportDialog.close}
          </button>
        </header>

        <div className="export-dialog-tabs segmented-toolbar" role="tablist" aria-label={t.exportDialog.title}>
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              disabled={item.disabled}
              className={`segmented-btn${tab === item.id ? " active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {commandsPartial && <p className="export-dialog-note">{t.export.copiedCommandsPartial}</p>}

        <div className="export-dialog-preview" role="tabpanel">
          {tab === "png" || tab === "pdf" ? (
            previewReady ? (
              <div className="export-dialog-png-wrap">
                {imageDataUrl ? (
                  <img src={imageDataUrl} alt="" className="export-dialog-png" />
                ) : canvas ? (
                  <img src={canvas.toDataURL("image/png")} alt="" className="export-dialog-png" />
                ) : null}
              </div>
            ) : null
          ) : tab === "raw" ? (
            <div className="export-dialog-raw">
              <dl>
                <div>
                  <dt>{t.exportDialog.rawFilename}</dt>
                  <dd>
                    <code>{rawFilename}</code>
                  </dd>
                </div>
                <div>
                  <dt>{t.exportDialog.rawProtocol}</dt>
                  <dd>{resolvedProtocol.toUpperCase()}</dd>
                </div>
                <div>
                  <dt>{t.exportDialog.rawSize}</dt>
                  <dd>{format(t.exportDialog.rawBytes, { n: payload.length })}</dd>
                </div>
              </dl>
              <p className="export-dialog-raw-hint">{preview}</p>
            </div>
          ) : (
            <textarea
              className="export-dialog-text"
              readOnly
              value={preview}
              spellCheck={false}
              aria-label={tabs.find((x) => x.id === tab)?.label}
            />
          )}
        </div>

        <footer className="export-dialog-actions">
          <button
            ref={copyRef}
            type="button"
            className="btn-sm btn-ghost"
            disabled={tab === "png" || tab === "pdf"}
            onClick={() => void onCopy()}
          >
            {t.exportDialog.copy}
          </button>
          <button type="button" className="btn-sm export-dialog-download" onClick={onDownload}>
            {t.exportDialog.download}
          </button>
        </footer>
      </div>
    </div>
  );
}
