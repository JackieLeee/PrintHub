import { hexToBytes, bitmapByteLength } from "./utils.js";

export interface BitmapHeader {
  x: number;
  y: number;
  width: number;
  height: number;
  mode: number;
  /** Hex payload on same line after header, if any */
  inlineHex: string;
}

function splitCommaParts(body: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let inQuote = false;
  for (const ch of body) {
    if (ch === '"') inQuote = !inQuote;
    if (ch === "," && !inQuote) {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}

/** Parse BITMAP x,y,w,h,mode[,hex] from a text line. */
export function parseBitmapHeader(line: string): BitmapHeader | null {
  const trimmed = line.trim();
  if (!trimmed.toUpperCase().startsWith("BITMAP")) return null;

  const body = trimmed.slice(6).trim();
  const parts = splitCommaParts(body);
  if (parts.length < 5) return null;

  const inlineHex = parts.slice(5).join(",").replace(/^,/, "");

  return {
    x: Number(parts[0]) || 0,
    y: Number(parts[1]) || 0,
    width: Number(parts[2]) || 0,
    height: Number(parts[3]) || 0,
    mode: Number(parts[4]) || 0,
    inlineHex,
  };
}

export function decodeBitmapData(
  header: BitmapHeader,
  trailingBinary: Uint8Array,
): { data: Uint8Array; consumed: number } {
  const expected = bitmapByteLength(header.width, header.height);

  if (header.inlineHex.length > 0) {
    const data = hexToBytes(header.inlineHex);
    if (data.length >= expected) return { data: data.slice(0, expected), consumed: 0 };
    if (data.length > 0) return { data, consumed: 0 };
  }

  if (trailingBinary.length >= expected) {
    return { data: trailingBinary.slice(0, expected), consumed: expected };
  }

  return { data: trailingBinary.slice(), consumed: trailingBinary.length };
}

export function decodeBitmapFromHex(hex: string, widthDots: number, heightDots: number): Uint8Array {
  const data = hexToBytes(hex);
  const expected = bitmapByteLength(widthDots, heightDots);
  if (data.length >= expected) return data.slice(0, expected);
  const out = new Uint8Array(expected);
  out.set(data);
  return out;
}
