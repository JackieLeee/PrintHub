import { useState } from "react";
import type { HubStatus } from "@virt-printer/shared";
import { DEFAULT_HTTP_PORT } from "@virt-printer/shared";
import { submitImageFile } from "../lib/print-api";
import { isDesktopApp } from "../lib/is-desktop";

interface Props {
  status: HubStatus | null;
}

export function ImageUploadPanel({ status }: Props) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<"escpos" | "tspl">("escpos");

  const hostIp = status?.hostIp ?? "localhost";
  const httpPort = status?.httpPort ?? DEFAULT_HTTP_PORT;
  const httpBase = `http://${hostIp}:${httpPort}`;
  const endpointHint = isDesktopApp()
    ? "桌面 IPC · printImage"
    : `POST ${httpBase}/print/image`;

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const json = await submitImageFile(httpBase, file, protocol, 384);
      setMessage(`已提交 ${json.jobId ?? "job"}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="upload-panel">
      <div className="upload-row">
        <label className="field-inline">
          <span>协议</span>
          <select value={protocol} onChange={(e) => setProtocol(e.target.value as "escpos" | "tspl")}>
            <option value="escpos">ESC/POS 小票</option>
            <option value="tspl">TSPL 标签</option>
          </select>
        </label>
        <label className="upload-btn">
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} disabled={uploading} />
          {uploading ? "上传中…" : "选择图片打印"}
        </label>
      </div>
      <div className="network-hint">
        <code>{endpointHint}</code>
      </div>
      {message && <div className="upload-msg">{message}</div>}
    </div>
  );
}
