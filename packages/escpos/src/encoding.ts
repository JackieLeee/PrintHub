const GBK_DECODER = new TextDecoder("gbk", { fatal: false });
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: false });

export function decodeTextBytes(bytes: Uint8Array, utf8: boolean, codePage: string): string {
  if (bytes.length === 0) return "";
  if (utf8 || codePage === "utf-8") return UTF8_DECODER.decode(bytes);
  if (codePage === "gbk" || codePage === "cp936" || codePage === "cp437") return GBK_DECODER.decode(bytes);

  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i]!;
    if (b >= 0x80 && i + 1 < bytes.length) {
      out += GBK_DECODER.decode(bytes.slice(i, i + 2));
      i += 2;
    } else if (b >= 0x20) {
      out += String.fromCharCode(b);
      i += 1;
    } else {
      i += 1;
    }
  }
  return out;
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
    255: "utf-8",
  };
  return map[code] ?? `cp${code}`;
}
