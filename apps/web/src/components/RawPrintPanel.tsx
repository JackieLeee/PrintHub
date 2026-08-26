import { useState } from "react";
import type { HubStatus } from "@virt-printer/shared";
import { useLocale } from "../i18n/context";
import { loadRawFile, loadRawFromText, type RawInputFormat } from "../lib/raw-input";
import { resolveHttpBase, submitRawPayload } from "../lib/print-api";
import {
  ESCPOS_SAMPLE_FILENAME,
  getEscPosSampleBytes,
  getTsplSampleBytes,
  TSPL_SAMPLE_FILENAME,
} from "../lib/samples";

interface Props {
  status: HubStatus | null;
}

type InputMode = "file" | "hex" | "base64";

export function RawPrintPanel({ status }: Props) {
  const { t, format } = useLocale();
  const [inputMode, setInputMode] = useState<InputMode>("file");
  const [textInput, setTextInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const httpBase = resolveHttpBase(status);

  async function handleSubmit(data: Uint8Array, label: string) {
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const result = await submitRawPayload(httpBase, data);
      const protocol = result.protocol ? ` (${result.protocol})` : "";
      setMessage(
        format(t.rawPrint.submitted, {
          jobId: result.jobId ?? "job",
          protocol,
          label,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t.rawPrint.submitFailed);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSample(kind: "escpos" | "tspl") {
    const data = kind === "escpos" ? getEscPosSampleBytes() : getTsplSampleBytes();
    const label = kind === "escpos" ? ESCPOS_SAMPLE_FILENAME : TSPL_SAMPLE_FILENAME;
    await handleSubmit(data, label);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const loaded = await loadRawFile(file);
      await handleSubmit(loaded.data, loaded.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.rawPrint.fileParseFailed);
    } finally {
      e.target.value = "";
    }
  }

  async function onTextSubmit() {
    const formatMode: RawInputFormat = inputMode === "hex" ? "hex" : "base64";
    try {
      const loaded = loadRawFromText(textInput, formatMode);
      await handleSubmit(loaded.data, loaded.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.rawPrint.decodeFailed);
    }
  }

  const tabLabels = {
    file: t.rawPrint.tabFile,
    hex: t.rawPrint.tabHex,
    base64: t.rawPrint.tabBase64,
  };

  return (
    <div className="raw-print-panel">
      <div className="sample-actions">
        <button
          type="button"
          className="btn-accent"
          disabled={submitting}
          onClick={() => void onSample("escpos")}
        >
          {submitting ? t.samples.printing : t.samples.printEscPos}
        </button>
        <button
          type="button"
          className="btn-accent"
          disabled={submitting}
          onClick={() => void onSample("tspl")}
        >
          {submitting ? t.samples.printing : t.samples.printTspl}
        </button>
      </div>

      <div className="raw-tabs">
        {(["file", "hex", "base64"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`raw-tab ${inputMode === mode ? "active" : ""}`}
            onClick={() => setInputMode(mode)}
          >
            {tabLabels[mode]}
          </button>
        ))}
      </div>

      {inputMode === "file" ? (
        <label className="upload-btn">
          <input
            type="file"
            accept=".bin,.escpos,.prn,.txt,application/octet-stream"
            onChange={onFileChange}
            disabled={submitting}
          />
          {submitting ? t.rawPrint.submitting : t.rawPrint.pickFile}
        </label>
      ) : (
        <>
          <textarea
            className="raw-textarea"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={inputMode === "hex" ? t.rawPrint.hexPlaceholder : t.rawPrint.base64Placeholder}
            rows={4}
            disabled={submitting}
          />
          <button type="button" onClick={() => void onTextSubmit()} disabled={submitting || !textInput.trim()}>
            {submitting ? t.rawPrint.submitting : t.rawPrint.decodePrint}
          </button>
        </>
      )}

      <div className="network-hint">
        POST <code>{httpBase}/print/raw</code>
      </div>
      {message && <div className="upload-msg ok">{message}</div>}
      {error && <div className="upload-msg err">{error}</div>}
    </div>
  );
}
