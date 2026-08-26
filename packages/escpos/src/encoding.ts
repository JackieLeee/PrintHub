const UTF8_DECODER = new TextDecoder("utf-8", { fatal: false });
const LATIN_DECODER = new TextDecoder("iso-8859-1", { fatal: false });

function createCjkDecoder(): TextDecoder {
  for (const label of ["gb18030", "gbk", "cp936"]) {
    try {
      return new TextDecoder(label, { fatal: false });
    } catch {
      /* try next */
    }
  }
  return UTF8_DECODER;
}

const CJK_DECODER = createCjkDecoder();

/** Strict UTF-8 structure validation (ASCII included). */
function isValidUtf8(bytes: Uint8Array): boolean {
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i]!;
    if (b <= 0x7f) {
      i += 1;
      continue;
    }
    if (b >= 0xc2 && b <= 0xdf) {
      if (i + 1 >= bytes.length || (bytes[i + 1]! & 0xc0) !== 0x80) return false;
      i += 2;
      continue;
    }
    if (b >= 0xe0 && b <= 0xef) {
      if (i + 2 >= bytes.length) return false;
      const b1 = bytes[i + 1]!;
      const b2 = bytes[i + 2]!;
      if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80) return false;
      i += 3;
      continue;
    }
    if (b >= 0xf0 && b <= 0xf4) {
      if (i + 3 >= bytes.length) return false;
      const b1 = bytes[i + 1]!;
      const b2 = bytes[i + 2]!;
      const b3 = bytes[i + 3]!;
      if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80 || (b3 & 0xc0) !== 0x80) return false;
      i += 4;
      continue;
    }
    return false;
  }
  return true;
}

export function decodeTextBytes(bytes: Uint8Array, utf8: boolean, codePage: string): string {
  if (bytes.length === 0) return "";

  const cp = codePage.toLowerCase();

  if (utf8 || cp === "utf-8") {
    return UTF8_DECODER.decode(bytes);
  }

  // Modern POS often sends UTF-8 without FS &
  if (isValidUtf8(bytes)) {
    return UTF8_DECODER.decode(bytes);
  }

  if (cp === "cp437" || cp === "cp850" || cp === "cp860") {
    return LATIN_DECODER.decode(bytes);
  }

  // Chinese / East Asian default
  return CJK_DECODER.decode(bytes);
}

export function readUint16LE(data: Uint8Array, offset: number): number {
  return data[offset]! + (data[offset + 1]! << 8);
}

export function symbologyFromGsK(code: number): import("./types.js").BarcodeSymbology {
  switch (code) {
    case 0:
      return "upca";
    case 2:
      return "ean13";
    case 3:
      return "ean8";
    case 4:
      return "code39";
    case 5:
      return "itf";
    case 6:
      return "codabar";
    case 7:
      return "code93";
    case 8:
    case 0x49:
      return "code128";
    case 9:
      return "gs1-128";
    default:
      return "unknown";
  }
}

export function hriFromCode(code: number): "none" | "above" | "below" | "both" {
  if (code === 1) return "above";
  if (code === 2) return "below";
  if (code === 3) return "both";
  return "none";
}

export function codePageName(code: number): string {
  const map: Record<number, string> = {
    0: "cp437",
    1: "cp932",
    2: "cp850",
    3: "cp860",
    17: "cp936",
    18: "cp936",
    19: "cp936",
    255: "utf-8",
  };
  return map[code] ?? `cp${code}`;
}
