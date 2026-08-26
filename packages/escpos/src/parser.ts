import {
  codePageName,
  decodeTextBytes,
  hriFromCode,
  readUint16LE,
  symbologyFromGsK,
} from "./encoding.js";
import type { EscPosCommand, EscPosParseResult, ParserState } from "./types.js";
import { defaultParserState } from "./types.js";

export function parseEscPos(payload: Uint8Array): EscPosParseResult {
  const parser = new EscPosParser(payload);
  return parser.parse();
}

class EscPosParser {
  private data: Uint8Array;
  private i = 0;
  private commands: EscPosCommand[] = [];
  private warnings: string[] = [];
  private state: ParserState = defaultParserState();
  private textBuf: number[] = [];

  constructor(data: Uint8Array) {
    this.data = data;
  }

  parse(): EscPosParseResult {
    while (this.i < this.data.length) {
      const byte = this.data[this.i]!;
      if (byte === 0x1b) {
        this.flushText();
        if (!this.parseEsc()) this.i += 1;
        continue;
      }
      if (byte === 0x1d) {
        this.flushText();
        if (!this.parseGs()) this.i += 1;
        continue;
      }
      if (byte === 0x1c) {
        this.flushText();
        if (!this.parseFs()) this.i += 1;
        continue;
      }
      if (byte === 0x10) {
        this.flushText();
        if (!this.parseDle()) this.i += 1;
        continue;
      }
      if (byte === 0x05 || byte === 0x00) {
        this.i += 1;
        continue;
      }
      if (byte === 0x0a || byte === 0x0d) {
        this.flushText();
        if (byte === 0x0a) this.commands.push({ kind: "line" });
        this.i += 1;
        if (byte === 0x0d && this.data[this.i] === 0x0a) this.i += 1;
        continue;
      }
      if (byte === 0x09) {
        this.textBuf.push(0x20, 0x20, 0x20, 0x20);
        this.i += 1;
        continue;
      }
      if (byte >= 0x20 || byte >= 0x80) {
        this.textBuf.push(byte);
        this.i += 1;
        continue;
      }
      this.warnings.push(`Skipped control byte 0x${byte.toString(16)} at ${this.i}`);
      this.i += 1;
    }
    this.flushText();
    return { commands: this.commands, warnings: this.warnings };
  }

  private flushText(): void {
    if (this.textBuf.length === 0) return;
    const bytes = new Uint8Array(this.textBuf);
    const text = decodeTextBytes(bytes, this.state.utf8, this.state.codePage);
    if (text.length > 0) {
      this.commands.push({
        kind: "text",
        text,
        bold: this.state.bold,
        underline: this.state.underline,
        doubleWidth: this.state.doubleWidth,
        doubleHeight: this.state.doubleHeight,
        doubleStrike: this.state.doubleStrike,
        font: this.state.font,
        align: this.state.align,
        codePage: this.state.codePage,
      });
    }
    this.textBuf = [];
  }

  private parseEsc(): boolean {
    const start = this.i;
    const cmd = this.data[this.i + 1];
    if (cmd === undefined) return false;

    if (cmd === 0x40) {
      this.state = defaultParserState();
      this.i += 2;
      return true;
    }
    if (cmd === 0x61 && this.i + 2 < this.data.length) {
      const mode = this.data[this.i + 2]!;
      this.state.align = mode === 1 ? "center" : mode === 2 ? "right" : "left";
      this.commands.push({ kind: "align", value: this.state.align });
      this.i += 3;
      return true;
    }
    if (cmd === 0x45 && this.i + 2 < this.data.length) {
      this.state.bold = this.data[this.i + 2]! !== 0;
      this.i += 3;
      return true;
    }
    if (cmd === 0x2d && this.i + 2 < this.data.length) {
      this.state.underline = this.data[this.i + 2]! !== 0;
      this.i += 3;
      return true;
    }
    if (cmd === 0x21 && this.i + 2 < this.data.length) {
      this.applyCharSize(this.data[this.i + 2]!);
      this.i += 3;
      return true;
    }
    if (cmd === 0x64 && this.i + 2 < this.data.length) {
      this.commands.push({ kind: "feed", lines: this.data[this.i + 2]! });
      this.i += 3;
      return true;
    }
    if (cmd === 0x4a && this.i + 2 < this.data.length) {
      this.commands.push({ kind: "feedUnits", units: this.data[this.i + 2]! });
      this.i += 3;
      return true;
    }
    if (cmd === 0x69) {
      this.commands.push({ kind: "cut", mode: "full" });
      this.i += 2;
      return true;
    }
    if (cmd === 0x6d) {
      this.commands.push({ kind: "cut", mode: "partial" });
      this.i += 2;
      return true;
    }
    if (cmd === 0x70 && this.i + 4 < this.data.length) {
      this.commands.push({
        kind: "cashDrawer",
        pin: this.data[this.i + 2]!,
        pulseOn: this.data[this.i + 3]!,
        pulseOff: this.data[this.i + 4]!,
      });
      this.i += 5;
      return true;
    }
    if (cmd === 0x74 && this.i + 2 < this.data.length) {
      this.state.codePage = codePageName(this.data[this.i + 2]!);
      this.state.utf8 = this.state.codePage === "utf-8";
      this.i += 3;
      return true;
    }
    if (cmd === 0x47) {
      this.state.doubleStrike = true;
      this.i += 2;
      return true;
    }
    if (cmd === 0x48) {
      this.state.doubleStrike = false;
      this.i += 2;
      return true;
    }
    if (cmd === 0x4d && this.i + 2 < this.data.length) {
      const n = this.data[this.i + 2]!;
      this.state.font = n === 1 || n === 49 ? "b" : "a";
      this.i += 3;
      return true;
    }
    if (cmd === 0x52 && this.i + 2 < this.data.length) {
      this.i += 3;
      return true;
    }
    if (cmd === 0x33 && this.i + 2 < this.data.length) {
      this.i += 3;
      return true;
    }
    if (cmd === 0x32) {
      this.i += 2;
      return true;
    }
    if (cmd === 0x7b && this.i + 2 < this.data.length) {
      this.i += 3;
      return true;
    }
    if (cmd === 0x2a && this.i + 4 < this.data.length) {
      const mode = this.data[this.i + 2]!;
      const nL = this.data[this.i + 3]!;
      const nH = this.data[this.i + 4]!;
      const width = nL + nH * 256;
      const bytesPerCol = mode === 0 ? 1 : mode === 1 ? 2 : 3;
      const height = 8 * bytesPerCol;
      const byteLen = width * bytesPerCol;
      if (this.i + 5 + byteLen <= this.data.length) {
        const slice = this.data.slice(this.i + 5, this.i + 5 + byteLen);
        this.commands.push({ kind: "bitImage", mode, width, height, data: slice });
        this.i += 5 + byteLen;
        return true;
      }
    }

    this.warnings.push(`Unhandled ESC 0x${cmd.toString(16)} at ${start}`);
    this.i += 2;
    return true;
  }

  private parseGs(): boolean {
    const start = this.i;
    const cmd = this.data[this.i + 1];
    if (cmd === undefined) return false;

    if (cmd === 0x21 && this.i + 2 < this.data.length) {
      this.applyCharSize(this.data[this.i + 2]!);
      this.i += 3;
      return true;
    }
    if (cmd === 0x56) {
      const mode = this.data[this.i + 2] ?? 0;
      this.commands.push({ kind: "cut", mode: mode === 0 || mode === 48 ? "full" : "partial" });
      this.i += this.data[this.i + 2] !== undefined ? 3 : 2;
      return true;
    }
    if (cmd === 0x68 && this.i + 2 < this.data.length) {
      // barcode height — stored for next GS k
      this._barcodeHeight = this.data[this.i + 2]!;
      this.i += 3;
      return true;
    }
    if (cmd === 0x77 && this.i + 2 < this.data.length) {
      this._barcodeWidth = this.data[this.i + 2]!;
      this.i += 3;
      return true;
    }
    if (cmd === 0x48 && this.i + 2 < this.data.length) {
      this._barcodeHri = hriFromCode(this.data[this.i + 2]!);
      this.i += 3;
      return true;
    }
    if (cmd === 0x6b) {
      return this.parseGsK();
    }
    if (cmd === 0x76 && this.i + 7 < this.data.length && this.data[this.i + 2] === 0x30) {
      const mode = this.data[this.i + 3]!;
      const xL = this.data[this.i + 4]!;
      const xH = this.data[this.i + 5]!;
      const yL = this.data[this.i + 6]!;
      const yH = this.data[this.i + 7]!;
      const widthBytes = xL + xH * 256;
      const height = yL + yH * 256;
      const dataLen = widthBytes * height;
      if (this.i + 8 + dataLen <= this.data.length) {
        const slice = this.data.slice(this.i + 8, this.i + 8 + dataLen);
        this.commands.push({ kind: "raster", widthBytes, height, mode, data: slice });
        this.i += 8 + dataLen;
        return true;
      }
    }
    if (cmd === 0x28 && this.data[this.i + 2] === 0x6b) {
      return this.parseGsQr();
    }
    if (cmd === 0x28 && this.data[this.i + 2] === 0x4c) {
      return this.parseGsGraphics();
    }

    this.warnings.push(`Unhandled GS 0x${cmd.toString(16)} at ${start}`);
    this.i += 2;
    return true;
  }

  private _barcodeHeight = 80;
  private _barcodeWidth = 2;
  private _barcodeHri: "none" | "above" | "below" | "both" = "below";

  private parseGsK(): boolean {
    const m = this.data[this.i + 2];
    if (m === undefined) return false;

    // Format: GS k m d... 0
    if (m <= 6) {
      let j = this.i + 3;
      while (j < this.data.length && this.data[j] !== 0) j += 1;
      const data = new TextDecoder().decode(this.data.slice(this.i + 3, j));
      this.commands.push({
        kind: "barcode",
        symbology: symbologyFromGsK(m),
        data,
        height: this._barcodeHeight,
        width: this._barcodeWidth,
        hri: this._barcodeHri,
      });
      this.i = j + 1;
      return true;
    }

    // GS k m n d...
    if (this.i + 3 >= this.data.length) return false;
    const n = this.data[this.i + 3]!;
    const data = new TextDecoder().decode(this.data.slice(this.i + 4, this.i + 4 + n));
    this.commands.push({
      kind: "barcode",
      symbology: symbologyFromGsK(m),
      data,
      height: this._barcodeHeight,
      width: this._barcodeWidth,
      hri: this._barcodeHri,
    });
    this.i += 4 + n;
    return true;
  }

  private parseGsQr(): boolean {
    // GS ( k pL pH cn fn [params]
    if (this.i + 5 >= this.data.length) return false;
    const pL = this.data[this.i + 3]!;
    const pH = this.data[this.i + 4]!;
    const plen = pL + pH * 256;
    const fn = this.data[this.i + 6];
    if (fn === undefined) return false;

    const chunkEnd = this.i + 5 + plen;
    if (chunkEnd > this.data.length) return false;

    if (fn === 0x31 || fn === 49) {
      // store QR data: cn fn m n data
      const param = this.data.slice(this.i + 7, chunkEnd);
      const storeIndex = param[2] ?? 0;
      if (storeIndex === 0x31 || storeIndex === 49) {
        const len = param[0]! + (param[1]! << 8);
        const qrData = new TextDecoder().decode(param.slice(4, 4 + len));
        this._qrData = qrData;
      }
    }
    if (fn === 0x32 || fn === 50) {
      const size = this.data[this.i + 7] ?? 4;
      this.commands.push({
        kind: "qrcode",
        data: this._qrData ?? "",
        model: 2,
        size,
        ecLevel: "M",
      });
    }

    this.i = chunkEnd + 1;
    return true;
  }

  private _qrData = "";

  private parseGsGraphics(): boolean {
    // GS ( L pL pH m fn — simplified: fn=112 store raster
    if (this.i + 6 >= this.data.length) return false;
    const pL = this.data[this.i + 3]!;
    const pH = this.data[this.i + 4]!;
    const plen = pL + pH * 256;
    const end = this.i + 5 + plen;
    if (end > this.data.length) return false;

    const fn = this.data[this.i + 6];
    if (fn === 0x70 || fn === 112) {
      const params = this.data.slice(this.i + 7, end);
      if (params.length >= 6) {
        const xL = params[4]!;
        const xH = params[5]!;
        const yL = params[6] ?? 0;
        const yH = params[7] ?? 0;
        const widthBytes = xL + xH * 256;
        const height = yL + yH * 256;
        const rasterStart = this.i + 7 + 8;
        if (rasterStart + widthBytes * height <= this.data.length) {
          this.commands.push({
            kind: "raster",
            widthBytes,
            height,
            mode: 0,
            data: this.data.slice(rasterStart, rasterStart + widthBytes * height),
          });
        }
      }
    }

    this.i = end + 1;
    return true;
  }

  private parseDle(): boolean {
    const sub = this.data[this.i + 1];
    if (sub === 0x04 && this.i + 2 < this.data.length) {
      this.i += 3;
      return true;
    }
    if (sub === 0x14 && this.i + 3 < this.data.length) {
      this.i += 4;
      return true;
    }
    return false;
  }

  private parseFs(): boolean {
    const cmd = this.data[this.i + 1];
    if (cmd === 0x26) {
      this.state.utf8 = true;
      this.state.codePage = "utf-8";
      this.i += 2;
      return true;
    }
    this.warnings.push(`Unhandled FS 0x${cmd?.toString(16) ?? "?"} at ${this.i}`);
    this.i += 2;
    return true;
  }

  private applyCharSize(n: number): void {
    this.state.doubleWidth = (n & 0x20) !== 0;
    this.state.doubleHeight = (n & 0x10) !== 0;
    this.state.bold = (n & 0x08) !== 0;
    this.state.underline = (n & 0x80) !== 0;
  }
}

export { readUint16LE };
