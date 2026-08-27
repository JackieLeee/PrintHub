import { bitmapDataLength, hexToBytes } from "./utils.js";
import type { BitmapHeader } from "./bitmap.js";

export interface ParsedBitmap {
  header: BitmapHeader;
  data: Uint8Array;
  nextOffset: number;
}

function matchKeyword(data: Uint8Array, offset: number, keyword: string): boolean {
  if (offset + keyword.length > data.length) return false;
  for (let i = 0; i < keyword.length; i++) {
    const a = data[offset + i]!;
    const b = keyword.charCodeAt(i);
    if (a >= 0x41 && a <= 0x5a) {
      if (a !== b && a + 32 !== b) return false;
    } else if (a >= 0x61 && a <= 0x7a) {
      if (a !== b && a - 32 !== b) return false;
    } else if (a !== b) {
      return false;
    }
  }
  return true;
}

function skipAsciiWs(data: Uint8Array, i: number): number {
  while (i < data.length && (data[i] === 0x20 || data[i] === 0x09)) i++;
  return i;
}

function skipLineBreak(data: Uint8Array, i: number): number {
  if (i < data.length && data[i] === 0x0d) i++;
  if (i < data.length && data[i] === 0x0a) i++;
  return i;
}

function readAsciiNumber(data: Uint8Array, i: number): { value: number; next: number } | null {
  const start = i;
  while (i < data.length && data[i]! >= 0x30 && data[i]! <= 0x39) i++;
  if (i === start) return null;
  const value = Number(new TextDecoder("ascii").decode(data.slice(start, i)));
  return Number.isFinite(value) ? { value, next: i } : null;
}

function isAsciiHexByte(b: number): boolean {
  return (b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x46) || (b >= 0x61 && b <= 0x66);
}

function isAsciiHexSlice(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  for (const b of bytes) {
    if (b === 0x20 || b === 0x09) continue;
    if (!isAsciiHexByte(b)) return false;
  }
  return true;
}

/** Parse BITMAP at byte offset; consumes inline hex or fixed-length binary body. */
export function parseBitmapAtOffset(data: Uint8Array, offset: number): ParsedBitmap | null {
  if (!matchKeyword(data, offset, "BITMAP")) return null;

  let i = offset + 6;
  i = skipAsciiWs(data, i);

  const fields: number[] = [];
  for (let f = 0; f < 5; f++) {
    const num = readAsciiNumber(data, i);
    if (!num) return null;
    fields.push(num.value);
    i = num.next;
    if (data[i] !== 0x2c) return null;
    i++;
  }

  const [x, y, width, height, mode] = fields;
  const expected = bitmapDataLength(width, height);
  const dataStart = i;

  let lineEnd = dataStart;
  while (lineEnd < data.length && data[lineEnd] !== 0x0d && data[lineEnd] !== 0x0a) {
    lineEnd++;
  }
  const inlineSlice = data.slice(dataStart, lineEnd);

  if (inlineSlice.length > 0 && isAsciiHexSlice(inlineSlice)) {
    const decoded = hexToBytes(new TextDecoder("latin1").decode(inlineSlice));
    if (decoded.length > 0) {
      return {
        header: { x, y, width, height, mode, inlineHex: "" },
        data: decoded.length >= expected ? decoded.slice(0, expected) : decoded,
        nextOffset: skipLineBreak(data, lineEnd),
      };
    }
  }

  let binaryStart = dataStart;
  if (inlineSlice.length === 0) {
    binaryStart = skipLineBreak(data, dataStart);
  }

  const available = data.length - binaryStart;
  const take = Math.min(expected, available);
  const bitmapData = data.slice(binaryStart, binaryStart + take);
  let nextOffset = binaryStart + take;
  if (take === expected) {
    nextOffset = skipLineBreak(data, nextOffset);
  }

  return {
    header: { x, y, width, height, mode, inlineHex: "" },
    data: bitmapData,
    nextOffset,
  };
}
