import { isTsplPayload } from "@virt-printer/tspl";
import {
  bytesToEscapeNotation,
  looksLikeEscapeWire,
  looksLikeTsplCommandText,
  parseEscapeNotation,
} from "./wire-format.js";

export function payloadToHex(data: Uint8Array, maxBytes = 8192): string {
  const slice = data.length > maxBytes ? data.subarray(0, maxBytes) : data;
  const hex = Array.from(slice)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
  return data.length > maxBytes ? `${hex} … (+${data.length - maxBytes} bytes)` : hex;
}

export function payloadToHexCompact(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function payloadToBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]!);
  return btoa(binary);
}

function isPrintableCommandByte(b: number): boolean {
  return b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e);
}

function isEscPosBinary(data: Uint8Array): boolean {
  if (data.length === 0) return false;
  if (isTsplPayload(data)) return false;
  let control = 0;
  const sample = Math.min(data.length, 512);
  for (let i = 0; i < sample; i++) {
    const b = data[i]!;
    if (b === 0x1b || b === 0x1d || b === 0x10) control++;
  }
  return control >= 2;
}

/** True when payload is plain TSPL-style command text. */
export function payloadIsTextCommands(data: Uint8Array): boolean {
  if (data.length === 0) return false;
  if (isTsplPayload(data)) return true;
  let printable = 0;
  for (let i = 0; i < data.length; i++) {
    if (isPrintableCommandByte(data[i]!)) printable++;
  }
  return printable / data.length >= 0.92;
}

function decodeCommandLine(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/** Export TSPL command lines (plain text). */
function tsplPayloadToCommands(data: Uint8Array): { text: string; partial: boolean } {
  const lines: string[] = [];
  let lineStart = 0;
  let hasBinaryLine = false;

  for (let i = 0; i <= data.length; i++) {
    const atEnd = i === data.length;
    const b = atEnd ? 0x0a : data[i]!;
    if (!atEnd && b !== 0x0a && b !== 0x0d) continue;

    const lineBytes = data.slice(lineStart, i);
    if (!atEnd && b === 0x0d && data[i + 1] === 0x0a) i++;

    lineStart = i + 1;
    if (lineBytes.length === 0) {
      if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
      continue;
    }

    let printable = 0;
    for (const byte of lineBytes) {
      if (isPrintableCommandByte(byte)) printable++;
    }

    if (printable / lineBytes.length >= 0.95) {
      lines.push(decodeCommandLine(lineBytes));
      continue;
    }

    hasBinaryLine = true;
    const head = decodeCommandLine(lineBytes.slice(0, Math.min(lineBytes.length, 96)));
    const bitmapHeader = head.match(/^BITMAP\s+[\d,\s]+/i);
    if (bitmapHeader) {
      lines.push(`${bitmapHeader[0].replace(/,\s*$/, "")},…`);
    }
  }

  const text = lines.join("\n").replace(/\n+$/, "");
  if (hasBinaryLine && text) return { text, partial: true };
  if (hasBinaryLine) {
    return {
      text: decodeCommandLine(data).replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
      partial: true,
    };
  }
  return { text, partial: false };
}

/**
 * Export clipboard-safe command text.
 * - TSPL: plain command lines
 * - ESC/POS binary: \\x wire escapes (round-trip via 指令 tab)
 */
export function payloadToCommands(data: Uint8Array): string {
  if (isTsplPayload(data)) {
    return tsplPayloadToCommands(data).text;
  }
  if (isEscPosBinary(data)) {
    return bytesToEscapeNotation(data);
  }
  if (payloadIsTextCommands(data)) {
    return tsplPayloadToCommands(data).text;
  }
  return bytesToEscapeNotation(data);
}

/** Whether copied commands can be pasted back into the 指令 tab verbatim. */
export function payloadCommandsAreRoundTrip(data: Uint8Array): boolean {
  if (isEscPosBinary(data)) return true;
  if (isTsplPayload(data)) {
    return !tsplPayloadToCommands(data).partial;
  }
  if (payloadIsTextCommands(data)) {
    return !tsplPayloadToCommands(data).partial;
  }
  return true;
}

export function downloadPayload(data: Uint8Array, filename: string): void {
  const blob = new Blob([data], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // HTTP (non-localhost) is not a secure context — fall back below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  try {
    const ok = document.execCommand("copy");
    if (!ok) throw new Error("execCommand copy failed");
  } finally {
    document.body.removeChild(textarea);
  }
}

export function defaultPayloadFilename(protocol: string, jobId: string): string {
  const ext = protocol === "tspl" ? "tspl" : "bin";
  return `print-${jobId.slice(0, 8)}.${ext}`;
}

export { looksLikeEscapeWire, looksLikeTsplCommandText, parseEscapeNotation };
