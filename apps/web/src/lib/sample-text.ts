import { payloadToBase64, payloadToHex, payloadToCommands } from "./payload-export";
import { getEscPosSampleBytes, getTsplSampleBytes } from "./samples";
import { bytesToEscapeNotation } from "./wire-format";

export type SampleKind = "escpos" | "tspl";
export type SampleTextMode = "escpos" | "tspl" | "hex" | "base64";

export function normalizeSampleText(text: string): string {
  return text.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function getSampleBytes(kind: SampleKind): Uint8Array {
  return kind === "escpos" ? getEscPosSampleBytes() : getTsplSampleBytes();
}

/** Encode sample bytes as text for the active debug-print input tab. */
export function formatSampleText(bytes: Uint8Array, mode: SampleTextMode): string {
  if (mode === "hex") return payloadToHex(bytes);
  if (mode === "base64") return payloadToBase64(bytes);
  if (mode === "tspl") return payloadToCommands(bytes);
  return bytesToEscapeNotation(bytes);
}

/** True when text matches a built-in sample for the active input tab format. */
export function isSampleText(text: string, mode: SampleTextMode): boolean {
  const normalized = normalizeSampleText(text);
  if (!normalized) return false;
  const kinds: SampleKind[] = ["escpos", "tspl"];
  return kinds.some((kind) => {
    const bytes = getSampleBytes(kind);
    return normalizeSampleText(formatSampleText(bytes, mode)) === normalized;
  });
}
