import type { HubStatus } from "@virt-printer/shared";
import { resolveHttpBaseFromBridge as resolveHttpBaseImpl } from "./bridge-url";
import { isDesktopApp, readFileAsBase64 } from "./is-desktop";

export interface RawPrintResult {
  jobId?: string;
  protocol?: string;
}

function bytesToBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]!);
  return btoa(binary);
}

export function resolveHttpBase(status: HubStatus | null): string {
  return resolveHttpBaseImpl(status?.hostIp ?? null);
}

export async function submitRawPayload(
  httpBase: string,
  data: Uint8Array,
): Promise<RawPrintResult> {
  if (isDesktopApp() && window.printhubDesktop) {
    const json = await window.printhubDesktop.printRaw(bytesToBase64(data));
    return json;
  }

  const res = await fetch(`${httpBase}/print/raw`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: data,
  });
  const json = (await res.json()) as { ok?: boolean; jobId?: string; protocol?: string; error?: string };
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json;
}

export async function submitImageFile(
  httpBase: string,
  file: File,
  protocol: "escpos" | "tspl",
  width = 384,
): Promise<{ jobId?: string }> {
  if (isDesktopApp() && window.printhubDesktop) {
    const imageBase64 = await readFileAsBase64(file);
    const json = await window.printhubDesktop.printImage({ imageBase64, protocol, width });
    return { jobId: json.jobId };
  }

  const res = await fetch(`${httpBase}/print/image?protocol=${protocol}&width=${width}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  const json = (await res.json()) as { ok?: boolean; jobId?: string; error?: string };
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return { jobId: json.jobId };
}
