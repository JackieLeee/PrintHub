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

export interface TsplMeasure {
  value: number;
  unit: TsplUnit;
}

const MEASURE_RE = /(-?[\d.]+)\s*(mm|inch|dot|in)?(?=\s|,|$)/gi;

function measureFromMatch(m: RegExpMatchArray | undefined, defaultUnit: TsplUnit): TsplMeasure {
  if (!m) return { value: 0, unit: defaultUnit };
  return {
    value: parseNumber(m[1]),
    unit: m[2] ? parseUnit(m[2]) : defaultUnit,
  };
}

/** Parse one TSC measure from the command tail, e.g. OFFSET 12.7 mm */
export function parseSingleMeasure(line: string, defaultUnit: TsplUnit = "inch"): TsplMeasure {
  const body = line.replace(/^[A-Z][A-Z0-9]*\s+/i, "").trim();
  const m = body.match(/(-?[\d.]+)\s*(mm|inch|dot|in)?/i);
  return measureFromMatch(m ?? undefined, defaultUnit);
}

/** Parse GAP/BLINE pair: GAP 2.0 mm 0.0 mm | GAP 0.12,0 | GAP 2 mm,0 mm */
export function parseMeasurePair(
  line: string,
  defaultUnit: TsplUnit = "inch",
): { first: TsplMeasure; second: TsplMeasure } {
  const body = line.replace(/^[A-Z][A-Z0-9]*\s+/i, "").trim();
  const matches = [...body.matchAll(MEASURE_RE)];
  return {
    first: measureFromMatch(matches[0], defaultUnit),
    second: measureFromMatch(matches[1], defaultUnit),
  };
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

/** TSPL BITMAP width is in bytes; height is in dots. */
export function bitmapDataLength(widthBytes: number, heightDots: number): number {
  return widthBytes * heightDots;
}

/** @deprecated Use bitmapDataLength — width must be bytes, not dots. */
export function bitmapByteLength(widthBytes: number, heightDots: number): number {
  return bitmapDataLength(widthBytes, heightDots);
}
