import type { HubStatus } from "@virt-printer/shared";
import { DEFAULT_HTTP_PORT } from "@virt-printer/shared";

export interface RawPrintResult {
  jobId?: string;
  protocol?: string;
}

export function resolveHttpBase(status: HubStatus | null): string {
  const httpPort = status?.httpPort ?? DEFAULT_HTTP_PORT;
  if (typeof window !== "undefined") {
    if (window.location.port === String(httpPort) || !window.location.port) {
      return window.location.origin;
    }
    const host = status?.hostIp ?? window.location.hostname;
    return `http://${host}:${httpPort}`;
  }
  const host = status?.hostIp ?? "localhost";
  return `http://${host}:${httpPort}`;
}

export async function submitRawPayload(
  httpBase: string,
  data: Uint8Array,
): Promise<RawPrintResult> {
  const res = await fetch(`${httpBase}/print/raw`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: data,
  });
  const json = (await res.json()) as { ok?: boolean; jobId?: string; protocol?: string; error?: string };
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json;
}
