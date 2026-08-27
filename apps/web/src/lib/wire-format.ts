/** Encode wire bytes as C-style escapes (printable ASCII literal, rest \\xNN). */
export function bytesToEscapeNotation(data: Uint8Array): string {
  let out = "";
  for (let i = 0; i < data.length; i++) {
    const b = data[i]!;
    if (b === 0x0a) out += "\\n";
    else if (b === 0x0d) out += "\\r";
    else if (b === 0x09) out += "\\t";
    else if (b === 0x5c) out += "\\\\";
    else if (b >= 0x20 && b <= 0x7e) out += String.fromCharCode(b);
    else out += `\\x${b.toString(16).padStart(2, "0").toUpperCase()}`;
  }
  return out;
}

/** Decode C-style \\x / \\n wire notation back to bytes. */
export function parseEscapeNotation(input: string): Uint8Array {
  const bytes: number[] = [];
  let i = 0;
  while (i < input.length) {
    if (input[i] === "\\" && i + 1 < input.length) {
      const next = input[i + 1]!;
      if (next === "n") {
        bytes.push(0x0a);
        i += 2;
        continue;
      }
      if (next === "r") {
        bytes.push(0x0d);
        i += 2;
        continue;
      }
      if (next === "t") {
        bytes.push(0x09);
        i += 2;
        continue;
      }
      if (next === "\\") {
        bytes.push(0x5c);
        i += 2;
        continue;
      }
      if ((next === "x" || next === "X") && i + 3 < input.length) {
        const hex = input.slice(i + 2, i + 4);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          bytes.push(Number.parseInt(hex, 16));
          i += 4;
          continue;
        }
      }
    }
    bytes.push(input.charCodeAt(i)! & 0xff);
    i++;
  }
  return new Uint8Array(bytes);
}

export function looksLikeEscapeWire(text: string): boolean {
  return /\\x[0-9a-fA-F]{2}/.test(text) || /\\[nrt\\]/.test(text);
}

export function looksLikeTsplCommandText(text: string): boolean {
  return /\b(SIZE|TEXT|BARCODE|CLS|PRINT|BITMAP|QRCODE|BOX|GAP|DIRECTION)\s/i.test(text);
}
