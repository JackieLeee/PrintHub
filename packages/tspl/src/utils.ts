import type { TsplUnit } from "./types.js";

export function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function parseUnit(token: string | undefined): TsplUnit {
  const t = (token ?? "").toLowerCase();
  if (t.includes("inch") || t === "in") return "inch";
  if (t.includes("mm")) return "mm";
  if (t.includes("dot")) return "dot";
  return "dot";
}

/** Split TSPL line into command + parameter tokens, respecting quoted strings. */
export function tokenizeLine(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
      continue;
    }
    if (!inQuote && (ch === "," || ch === " ")) {
      if (current.trim()) tokens.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

export function extractQuotedStrings(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"\\]|\\.)*"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    out.push(m[0]!.slice(1, -1));
  }
  return out;
}

export function unquote(s: string): string {
  const t = s.trim();
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  return t;
}

export function toDots(value: number, unit: TsplUnit): number {
  if (unit === "mm") return Math.round(value * 8);
  if (unit === "inch") return Math.round(value * 203);
  return Math.round(value);
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length === 0) return new Uint8Array(0);
  const len = Math.floor(clean.length / 2);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bitmapByteLength(widthDots: number, heightDots: number): number {
  const widthBytes = Math.ceil(widthDots / 8);
  return widthBytes * heightDots;
}
