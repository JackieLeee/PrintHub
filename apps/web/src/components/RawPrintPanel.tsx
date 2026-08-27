import { useEffect, useState } from "react";
import { useLocale } from "../i18n/context";
import { loadRawFile, loadRawFromText } from "../lib/raw-input";
import { CommandReference } from "./CommandReference";
import {
  ESCPOS_SAMPLE_FILENAME,
  getEscPosSampleBytes,
  getTsplSampleBytes,
  TSPL_SAMPLE_FILENAME,
} from "../lib/samples";

interface Props {
  onPreview: (payload: Uint8Array, label: string) => void;
  onCmdRefOpenChange?: (open: boolean) => void;
}

type InputMode = "file" | "hex" | "base64" | "tspl" | "escpos";

export function RawPrintPanel({ onPreview, onCmdRefOpenChange }: Props) {
  const { t, format } = useLocale();
  const [inputMode, setInputMode] = useState<InputMode>("file");
  const [textInput, setTextInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (inputMode !== "escpos" && inputMode !== "tspl") {
      onCmdRefOpenChange?.(false);
    }
  }, [inputMode, onCmdRefOpenChange]);

  function previewPayload(data: Uint8Array, label: string) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      onPreview(data, label);
      setMessage(format(t.rawPrint.previewed, { label }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.rawPrint.previewFailed);
    } finally {
      setBusy(false);
    }
  }

  function onSample(kind: "escpos" | "tspl") {
    const data = kind === "escpos" ? getEscPosSampleBytes() : getTsplSampleBytes();
    const label = kind === "escpos" ? ESCPOS_SAMPLE_FILENAME : TSPL_SAMPLE_FILENAME;
    previewPayload(data, label);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const loaded = await loadRawFile(file);
      previewPayload(loaded.data, loaded.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.rawPrint.fileParseFailed);
    } finally {
      e.target.value = "";
    }
  }

  function onTextSubmit() {
    try {
      const formatMap = {
        hex: "hex",
        base64: "base64",
        tspl: "tspl",
        escpos: "escpos",
      } as const;
      const loaded = loadRawFromText(textInput, formatMap[inputMode as keyof typeof formatMap]);
      previewPayload(loaded.data, loaded.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.rawPrint.decodeFailed);
    }
  }

  const tabLabels = {
    file: t.rawPrint.tabFile,
    hex: t.rawPrint.tabHex,
    base64: t.rawPrint.tabBase64,
    tspl: t.rawPrint.tabTspl,
    escpos: t.rawPrint.tabEscpos,
  };

  function placeholderFor(mode: InputMode): string {
    if (mode === "hex") return t.rawPrint.hexPlaceholder;
    if (mode === "base64") return t.rawPrint.base64Placeholder;
    if (mode === "tspl") return t.rawPrint.tsplPlaceholder;
    return t.rawPrint.escposPlaceholder;
  }

  function submitLabelFor(mode: InputMode): string {
    if (mode === "tspl") return t.rawPrint.tsplPreview;
    if (mode === "escpos") return t.rawPrint.escposPreview;
    return t.rawPrint.decodePreview;
  }

  return (
    <div className="raw-print-panel">
      <p className="raw-local-hint">{t.rawPrint.localHint}</p>

      <div className="sample-actions">
        <button
          type="button"
          className="btn-accent"
          disabled={busy}
          onClick={() => onSample("escpos")}
        >
          {busy ? t.samples.printing : t.samples.previewEscPos}
        </button>
        <button
          type="button"
          className="btn-accent"
          disabled={busy}
          onClick={() => onSample("tspl")}
        >
          {busy ? t.samples.printing : t.samples.previewTspl}
        </button>
      </div>

      <div className="raw-tabs">
        {(["file", "hex", "base64", "tspl", "escpos"] as const).map((mode) => (
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
            accept=".bin,.escpos,.prn,.txt,.tspl,application/octet-stream"
            onChange={onFileChange}
            disabled={busy}
          />
          {busy ? t.rawPrint.submitting : t.rawPrint.pickFile}
        </label>
      ) : (
        <>
          {inputMode === "escpos" && <p className="raw-format-hint">{t.rawPrint.escposHint}</p>}
          <textarea
            className="raw-textarea"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={placeholderFor(inputMode)}
            rows={inputMode === "tspl" || inputMode === "escpos" ? 8 : 4}
            disabled={busy}
            spellCheck={false}
          />
          {(inputMode === "tspl" || inputMode === "escpos") && (
            <CommandReference protocol={inputMode} onOpenChange={onCmdRefOpenChange} />
          )}
          <button type="button" onClick={onTextSubmit} disabled={busy || !textInput.trim()}>
            {busy ? t.rawPrint.submitting : submitLabelFor(inputMode)}
          </button>
        </>
      )}

      {message && <div className="upload-msg ok">{message}</div>}
      {error && <div className="upload-msg err">{error}</div>}
    </div>
  );
}
