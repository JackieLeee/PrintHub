import { useState } from "react";
import type { HubStatus } from "@virt-printer/shared";
import { DEFAULT_HTTP_PORT } from "@virt-printer/shared";
import { loadRawFile, loadRawFromText, type RawInputFormat } from "../lib/raw-input";

interface Props {
  status: HubStatus | null;
}

type InputMode = "file" | "hex" | "base64";

async function submitRaw(httpBase: string, data: Uint8Array): Promise<{ jobId?: string; protocol?: string }> {
  const res = await fetch(`${httpBase}/print/raw`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: data,
  });
  const json = (await res.json()) as { ok?: boolean; jobId?: string; protocol?: string; error?: string };
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json;
}

export function RawPrintPanel({ status }: Props) {
  const [inputMode, setInputMode] = useState<InputMode>("file");
  const [textInput, setTextInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hostIp = status?.hostIp ?? "localhost";
  const httpPort = status?.httpPort ?? DEFAULT_HTTP_PORT;
  const httpBase = `http://${hostIp}:${httpPort}`;

  async function handleSubmit(data: Uint8Array, label: string) {
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const result = await submitRaw(httpBase, data);
      setMessage(`已提交 ${result.jobId ?? "job"}${result.protocol ? ` (${result.protocol})` : ""} · ${label}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const loaded = await loadRawFile(file);
      await handleSubmit(loaded.data, loaded.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "文件解析失败");
    } finally {
      e.target.value = "";
    }
  }

  async function onTextSubmit() {
    const format: RawInputFormat = inputMode === "hex" ? "hex" : "base64";
    try {
      const loaded = loadRawFromText(textInput, format);
      await handleSubmit(loaded.data, loaded.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "解码失败");
    }
  }

  return (
    <div className="raw-print-panel">
      <div className="raw-tabs">
        {(["file", "hex", "base64"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`raw-tab ${inputMode === mode ? "active" : ""}`}
            onClick={() => setInputMode(mode)}
          >
            {mode === "file" ? "File" : mode === "hex" ? "Hex" : "Base64"}
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
          {submitting ? "提交中…" : "选择二进制文件"}
        </label>
      ) : (
        <>
          <textarea
            className="raw-textarea"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={
              inputMode === "hex"
                ? "粘贴十六进制，如 1B 40 48 65 6C 6C 6F"
                : "粘贴 Base64 编码的 ESC/POS 或 TSPL 数据"
            }
            rows={4}
            disabled={submitting}
          />
          <button type="button" onClick={() => void onTextSubmit()} disabled={submitting || !textInput.trim()}>
            {submitting ? "提交中…" : "解码并打印"}
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
