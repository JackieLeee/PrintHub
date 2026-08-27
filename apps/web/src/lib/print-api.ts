import type { HubStatus } from "@virt-printer/shared";
import { resolveHttpBaseFromBridge as resolveHttpBaseImpl } from "./bridge-url";

export interface RawPrintResult {
  jobId?: string;
  protocol?: string;
}

export function resolveHttpBase(status: HubStatus | null): string {
  return resolveHttpBaseImpl(status?.hostIp ?? null);
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
