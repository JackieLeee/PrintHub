export type RawInputFormat = "binary" | "hex" | "base64";

export interface DecodedRawInput {
  data: Uint8Array;
  name: string;
  format: RawInputFormat;
  size: number;
}

function detectFormat(bytes: Uint8Array, fileName: string): RawInputFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".bin") || lower.endsWith(".escpos") || lower.endsWith(".prn")) {
    return "binary";
  }

  const text = new TextDecoder("ascii", { fatal: false }).decode(bytes.slice(0, Math.min(bytes.length, 256)));
  const trimmed = text.trim();

  if (/^[0-9a-fA-F\s]+$/.test(trimmed) && trimmed.length >= 2) {
    return "hex";
  }

  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length >= 4) {
    return "base64";
  }

  return "binary";
}

function parseHexString(input: string): Uint8Array {
  const cleaned = input.replace(/[^0-9a-fA-F]/g, "");
  if (cleaned.length % 2 !== 0) {
    throw new Error("Hex 输入字符数为奇数");
  }
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function parseBase64String(input: string): Uint8Array {
  const cleaned = input.replace(/\s/g, "");
  let binary: string;
  try {
    binary = atob(cleaned);
  } catch {
    throw new Error("无效的 Base64 输入");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function decodeInput(bytes: Uint8Array, format: RawInputFormat): Uint8Array {
  if (format === "binary") return bytes;

  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (format === "hex") return parseHexString(text);
  if (format === "base64") return parseBase64String(text);
  return bytes;
}

export async function loadRawFile(file: File): Promise<DecodedRawInput> {
  const buffer = await file.arrayBuffer();
  const raw = new Uint8Array(buffer);
  const format = detectFormat(raw, file.name);
  const data = decodeInput(raw, format);

  return {
    name: file.name,
    data,
    format,
    size: data.length,
  };
}

export function loadRawFromText(text: string, format: RawInputFormat): DecodedRawInput {
  const raw = new TextEncoder().encode(text);
  const data = decodeInput(raw, format);

  return {
    name: format === "hex" ? "pasted.hex" : format === "base64" ? "pasted.b64" : "pasted.bin",
    data,
    format,
    size: data.length,
  };
}
