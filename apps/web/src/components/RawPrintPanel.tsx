import { useEffect, useRef, useState } from "react";
import { useAutoResizeTextarea } from "../hooks/use-auto-resize-textarea";
import { useLocale } from "../i18n/context";
import { loadRawFile, loadRawFromText } from "../lib/raw-input";
import {
  formatSampleText,
  getSampleBytes,
  isSampleText,
  normalizeSampleText,
  type SampleKind,
  type SampleTextMode,
} from "../lib/sample-text";
import { showToast } from "../lib/toast";
import { CommandReference } from "./CommandReference";
import { SampleOverwriteDialog, TabSwitchConfirmDialog } from "./ConfirmDialog";
import { DisclosureToggle } from "./DisclosureToggle";
import { ESCPOS_COMMANDS, TSPL_COMMANDS } from "../lib/command-reference";

interface Props {
  onPreview: (payload: Uint8Array, label: string) => void;
}

const TAB_ORDER = ["escpos", "tspl", "base64", "hex", "file"] as const;
type InputMode = (typeof TAB_ORDER)[number];
const CLEAR_ARM_MS = 3000;

function SampleControl({
  inputMode,
  onSample,
}: {
  inputMode: InputMode;
  onSample: (kind: SampleKind) => void;
}) {
  const { t } = useLocale();
  const menuRef = useRef<HTMLDetailsElement>(null);

  function pickSample(kind: SampleKind) {
    menuRef.current?.removeAttribute("open");
    onSample(kind);
  }

  if (inputMode === "escpos") {
    return (
      <button type="button" className="btn-sm sample-load-btn" onClick={() => pickSample("escpos")}>
        {t.rawPrint.loadEscPosSample}
      </button>
    );
  }

  if (inputMode === "tspl") {
    return (
      <button type="button" className="btn-sm sample-load-btn" onClick={() => pickSample("tspl")}>
        {t.rawPrint.loadTsplSample}
      </button>
    );
  }

  return (
    <details ref={menuRef} className="sample-menu">
      <summary className="sample-menu-trigger">{t.rawPrint.loadSample}</summary>
      <div className="sample-menu-panel">
        <button type="button" onClick={() => pickSample("escpos")}>
          {t.rawPrint.loadEscPosSample}
        </button>
        <button type="button" onClick={() => pickSample("tspl")}>
          {t.rawPrint.loadTsplSample}
        </button>
      </div>
    </details>
  );
}

export function RawPrintPanel({ onPreview }: Props) {
  const { t, format } = useLocale();
  const [inputMode, setInputMode] = useState<InputMode>("escpos");
  const [textInput, setTextInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [cmdRefOpen, setCmdRefOpen] = useState(false);
  const [overwriteText, setOverwriteText] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<InputMode | null>(null);
  const [clearArmed, setClearArmed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const clearArmTimerRef = useRef<number | null>(null);
  const isTextMode = inputMode !== "file";

  useAutoResizeTextarea(textareaRef, textInput, isTextMode);

  function disarmClear() {
    setClearArmed(false);
    if (clearArmTimerRef.current !== null) {
      window.clearTimeout(clearArmTimerRef.current);
      clearArmTimerRef.current = null;
    }
  }

  function armClear() {
    disarmClear();
    setClearArmed(true);
    clearArmTimerRef.current = window.setTimeout(() => {
      setClearArmed(false);
      clearArmTimerRef.current = null;
    }, CLEAR_ARM_MS);
  }

  function handleClearClick() {
    if (!textInput.trim()) return;
    if (!clearArmed) {
      armClear();
      return;
    }
    disarmClear();
    setTextInput("");
  }

  useEffect(() => () => disarmClear(), []);

  useEffect(() => {
    disarmClear();
  }, [inputMode]);

  useEffect(() => {
    if (clearArmed) disarmClear();
  }, [textInput]);

  useEffect(() => {
    if (inputMode !== "escpos" && inputMode !== "tspl") {
      setCmdRefOpen(false);
    }
  }, [inputMode]);

  const cmdRefProtocol =
    inputMode === "tspl" || inputMode === "escpos" ? inputMode : null;
  const cmdRefCount =
    cmdRefProtocol === "tspl"
      ? TSPL_COMMANDS.length
      : cmdRefProtocol === "escpos"
        ? ESCPOS_COMMANDS.length
        : 0;
  const cmdRefTitle =
    cmdRefProtocol === "tspl"
      ? t.cmdRef.titleTspl
      : cmdRefProtocol === "escpos"
        ? t.cmdRef.titleEscpos
        : "";

  function previewPayload(data: Uint8Array, label: string) {
    setBusy(true);
    try {
      onPreview(data, label);
      showToast(format(t.rawPrint.previewed, { label }), "ok");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.rawPrint.previewFailed, "err");
    } finally {
      setBusy(false);
    }
  }

  function applySampleText(text: string) {
    setTextInput(text);
    showToast(t.rawPrint.sampleLoaded, "ok");
  }

  function requestSampleLoad(kind: SampleKind) {
    const bytes = getSampleBytes(kind);
    const text = formatSampleText(bytes, inputMode as SampleTextMode);
    const current = normalizeSampleText(textInput);
    const next = normalizeSampleText(text);

    if (!current) {
      applySampleText(text);
      return;
    }
    if (current === next) {
      return;
    }
    setOverwriteText(text);
  }

  function confirmOverwrite() {
    if (overwriteText !== null) {
      applySampleText(overwriteText);
    }
    setOverwriteText(null);
  }

  function applyModeChange(mode: InputMode) {
    setInputMode(mode);
    setTextInput("");
    setCmdRefOpen(false);
  }

  function requestModeChange(mode: InputMode) {
    if (mode === inputMode) return;

    const hasText = textInput.trim().length > 0;
    const leavingTextMode = inputMode !== "file";
    const needsClear = hasText && leavingTextMode;

    if (!needsClear) {
      applyModeChange(mode);
      return;
    }

    if (isSampleText(textInput, inputMode as SampleTextMode)) {
      applyModeChange(mode);
      return;
    }

    setPendingMode(mode);
  }

  function confirmTabSwitch() {
    if (pendingMode !== null) {
      applyModeChange(pendingMode);
    }
    setPendingMode(null);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const loaded = await loadRawFile(file);
      previewPayload(loaded.data, loaded.name);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.rawPrint.fileParseFailed, "err");
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
      showToast(err instanceof Error ? err.message : t.rawPrint.decodeFailed, "err");
    }
  }

  const tabLabels: Record<InputMode, string> = {
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

  const showCmdRef = inputMode === "tspl" || inputMode === "escpos";

  return (
    <div className={`raw-print-panel${cmdRefOpen ? " raw-print-panel--cmd-ref-open" : ""}`}>
      <SampleOverwriteDialog
        open={overwriteText !== null}
        onConfirm={confirmOverwrite}
        onCancel={() => setOverwriteText(null)}
      />
      <TabSwitchConfirmDialog
        open={pendingMode !== null}
        onConfirm={confirmTabSwitch}
        onCancel={() => setPendingMode(null)}
      />

      <div className="raw-print-top">
        <p className="raw-local-hint">{t.rawPrint.localHint}</p>
        {inputMode !== "file" && (
          <SampleControl inputMode={inputMode} onSample={requestSampleLoad} />
        )}
      </div>

      <div className="raw-tabs">
        {TAB_ORDER.map((mode) => (
          <button
            key={mode}
            type="button"
            className={`raw-tab ${inputMode === mode ? "active" : ""}`}
            onClick={() => requestModeChange(mode)}
          >
            {tabLabels[mode]}
          </button>
        ))}
      </div>

      {inputMode === "file" ? (
        <label className="upload-dropzone">
          <input
            type="file"
            accept=".bin,.escpos,.prn,.txt,.tspl,application/octet-stream"
            onChange={onFileChange}
            disabled={busy}
          />
          <span className="upload-dropzone-title">
            {busy ? t.rawPrint.submitting : t.rawPrint.pickFile}
          </span>
          <span className="upload-dropzone-hint">{t.rawPrint.fileDropHint}</span>
        </label>
      ) : (
        <>
          {inputMode === "escpos" && <p className="raw-format-hint">{t.rawPrint.escposHint}</p>}
          <div className="raw-editor-stack">
            <textarea
              ref={textareaRef}
              className="raw-textarea raw-textarea--grow"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={placeholderFor(inputMode)}
              disabled={busy}
              spellCheck={false}
              rows={1}
            />
          </div>
          <div className="raw-action-row">
            <button
              type="button"
              className="raw-preview-btn raw-preview-btn--primary"
              onClick={onTextSubmit}
              disabled={busy || !textInput.trim()}
            >
              {busy ? t.rawPrint.submitting : submitLabelFor(inputMode)}
            </button>
            <button
              type="button"
              className={`btn-ghost raw-clear-btn${clearArmed ? " raw-clear-btn--armed" : ""}`}
              onClick={handleClearClick}
              disabled={busy || !textInput.trim()}
              aria-pressed={clearArmed}
            >
              {clearArmed ? t.rawPrint.clearInputConfirm : t.rawPrint.clearInput}
            </button>
          </div>
          {showCmdRef && (
            <div className="raw-cmd-ref-block">
              <button
                type="button"
                className={`cmd-ref-trigger ${cmdRefOpen ? "active" : ""}`}
                aria-expanded={cmdRefOpen}
                onClick={() => setCmdRefOpen((open) => !open)}
              >
                <DisclosureToggle open={cmdRefOpen} />
                <span className="cmd-ref-trigger-title">
                  {cmdRefTitle} ({cmdRefCount})
                </span>
              </button>
              {cmdRefOpen && (
                <div className="raw-cmd-ref raw-cmd-ref--open">
                  <CommandReference protocol={inputMode} embedded open />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
