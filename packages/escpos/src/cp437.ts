/** IBM PC code page 437 — Unicode mapping for bytes 0x80–0xFF. */
const CP437_UNICODE =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌┴┬┐▄▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■";

export function decodeCp437(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    if (byte <= 0x7f) {
      out += String.fromCharCode(byte);
    } else {
      out += CP437_UNICODE[byte - 0x80] ?? "\ufffd";
    }
  }
  return out;
}

function decodeWithLabel(bytes: Uint8Array, labels: string[]): string | null {
  for (const label of labels) {
    try {
      return new TextDecoder(label).decode(bytes);
    } catch {
      /* try next */
    }
  }
  return null;
}

export function decodeCp850(bytes: Uint8Array): string {
  return decodeWithLabel(bytes, ["ibm850", "cp850", "windows-1252"]) ?? decodeCp437(bytes);
}

export function decodeCp860(bytes: Uint8Array): string {
  return decodeWithLabel(bytes, ["ibm860", "cp860"]) ?? decodeCp437(bytes);
}
