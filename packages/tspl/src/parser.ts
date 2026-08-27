import { decodeBitmapData, parseBitmapHeader } from "./bitmap.js";
import { parseBitmapAtOffset } from "./bitmap-scan.js";
import type { TsplCommand, TsplParseResult, TsplUnit } from "./types.js";
import {
  extractQuotedStrings,
  parseMeasurePair,
  parseNumber,
  parseSingleMeasure,
  parseUnit,
  tokenizeLine,
  unquote,
} from "./utils.js";

export function parseTspl(payload: Uint8Array): TsplParseResult {
  return new TsplParser(payload).parse();
}

class TsplParser {
  private data: Uint8Array;
  private i = 0;
  private commands: TsplCommand[] = [];
  private warnings: string[] = [];

  constructor(data: Uint8Array) {
    this.data = data;
  }

  parse(): TsplParseResult {
    while (this.i < this.data.length) {
      while (this.i < this.data.length) {
        const b = this.data[this.i]!;
        if (b === 0x0a || b === 0x0d || b === 0x20 || b === 0x09) {
          this.i++;
          continue;
        }
        break;
      }
      if (this.i >= this.data.length) break;

      const bitmap = parseBitmapAtOffset(this.data, this.i);
      if (bitmap) {
        this.pushBitmap(bitmap);
        this.i = bitmap.nextOffset;
        continue;
      }

      const lineStart = this.i;
      const line = this.readLine();
      if (!line.trim()) continue;

      const upper = line.trim().toUpperCase();
      if (upper.startsWith("BITMAP")) {
        this.i = lineStart;
        this.parseBitmapLine(line);
        continue;
      }

      this.parseTextLine(line);
    }
    return { commands: this.commands, warnings: this.warnings };
  }

  private pushBitmap(bitmap: { header: { x: number; y: number; width: number; height: number; mode: number }; data: Uint8Array }): void {
    const { header, data } = bitmap;
    if (data.length === 0) {
      this.warnings.push(`BITMAP ${header.width}x${header.height} — no image data`);
      return;
    }
    this.commands.push({
      kind: "bitmap",
      x: header.x,
      y: header.y,
      width: header.width,
      height: header.height,
      mode: header.mode,
      data,
    });
  }

  private parseBitmapLine(line: string): void {
    const header = parseBitmapHeader(line);
    if (!header) {
      this.warnings.push(`Invalid BITMAP line: ${line.slice(0, 48)}`);
      return;
    }

    const { data, consumed } = decodeBitmapData(header, this.trailingBytes());
    if (consumed > 0) this.i += consumed;

    this.pushBitmap({ header, data });
  }

  private readLine(): string {
    const start = this.i;
    while (this.i < this.data.length) {
      const b = this.data[this.i]!;
      if (b === 0x0a || b === 0x0d) {
        const end = this.i;
        this.i += 1;
        if (b === 0x0d && this.data[this.i] === 0x0a) this.i += 1;
        return new TextDecoder("utf-8", { fatal: false }).decode(this.data.slice(start, end));
      }
      this.i += 1;
    }
    if (start === this.i) return "";
    return new TextDecoder("utf-8", { fatal: false }).decode(this.data.slice(start));
  }

  private trailingBytes(): Uint8Array {
    return this.data.slice(this.i);
  }

  private parseTextLine(line: string): void {
    const trimmed = line.trim();
    const tokens = tokenizeLine(trimmed);
    if (tokens.length === 0) return;
    const cmd = tokens[0]!.toUpperCase();

    switch (cmd) {
      case "SIZE":
        this.parseSize(trimmed);
        break;
      case "GAP":
        this.pushMeasurePair("gap", trimmed);
        break;
      case "BLINE":
        this.pushMeasurePair("bline", trimmed);
        break;
      case "DIRECTION":
        this.commands.push({
          kind: "direction",
          value: parseNumber(tokens[1]) === 1 ? 1 : 0,
          mirror: parseNumber(tokens[2]) === 1 ? 1 : 0,
        });
        break;
      case "REFERENCE":
        this.commands.push({ kind: "reference", x: parseNumber(tokens[1]), y: parseNumber(tokens[2]) });
        break;
      case "OFFSET": {
        const measure = parseSingleMeasure(trimmed);
        this.commands.push({ kind: "offset", value: measure.value, unit: measure.unit });
        break;
      }
      case "SHIFT":
        if (tokens.length >= 3) {
          this.commands.push({ kind: "shift", x: parseNumber(tokens[1]), y: parseNumber(tokens[2]) });
        } else {
          this.commands.push({ kind: "shift", x: 0, y: parseNumber(tokens[1]) });
        }
        break;
      case "SPEED":
        this.commands.push({ kind: "speed", ips: parseNumber(tokens[1]) });
        break;
      case "DENSITY":
        this.commands.push({ kind: "density", level: parseNumber(tokens[1]) });
        break;
      case "FEED":
        this.commands.push({ kind: "feed", dots: parseNumber(tokens[1]) });
        break;
      case "BACKFEED":
        this.commands.push({ kind: "backfeed", dots: parseNumber(tokens[1]) });
        break;
      case "FORMFEED":
        this.commands.push({ kind: "formfeed" });
        break;
      case "SET":
      case "SETPEEL":
      case "SETCUTTER":
      case "SETTEAR":
      case "COUNTRY":
        // Printer hardware settings — no structured preview effect.
        break;
      case "CLS":
        this.commands.push({ kind: "cls" });
        break;
      case "HOME":
        this.commands.push({ kind: "home" });
        break;
      case "TEXT":
        this.parseText(trimmed, tokens);
        break;
      case "BLOCK":
        this.parseBlock(trimmed, tokens);
        break;
      case "BARCODE":
        this.parseBarcode(trimmed, tokens);
        break;
      case "QRCODE":
        this.parseQrcode(trimmed, tokens);
        break;
      case "BOX":
        this.commands.push({
          kind: "box",
          x: parseNumber(tokens[1]),
          y: parseNumber(tokens[2]),
          xEnd: parseNumber(tokens[3]),
          yEnd: parseNumber(tokens[4]),
          thickness: parseNumber(tokens[5]) || 1,
          radius: parseNumber(tokens[6]) || 0,
        });
        break;
      case "BAR":
        this.commands.push({
          kind: "bar",
          x: parseNumber(tokens[1]),
          y: parseNumber(tokens[2]),
          width: parseNumber(tokens[3]),
          height: parseNumber(tokens[4]),
        });
        break;
      case "CIRCLE":
        this.commands.push({
          kind: "circle",
          x: parseNumber(tokens[1]),
          y: parseNumber(tokens[2]),
          diameter: parseNumber(tokens[3]),
          thickness: parseNumber(tokens[4]) || 1,
        });
        break;
      case "ELLIPSE":
        this.commands.push({
          kind: "ellipse",
          x: parseNumber(tokens[1]),
          y: parseNumber(tokens[2]),
          width: parseNumber(tokens[3]),
          height: parseNumber(tokens[4]),
          thickness: parseNumber(tokens[5]) || 1,
        });
        break;
      case "REVERSE":
        this.commands.push({
          kind: "reverse",
          x: parseNumber(tokens[1]),
          y: parseNumber(tokens[2]),
          width: parseNumber(tokens[3]),
          height: parseNumber(tokens[4]),
        });
        break;
      case "PRINT":
        this.commands.push({
          kind: "print",
          copies: parseNumber(tokens[1]) || 1,
          sets: parseNumber(tokens[2]) || 1,
        });
        break;
      case "PUTBMP":
      case "PUTPCX":
        this.warnings.push(`${cmd} file reference not supported in preview: ${trimmed.slice(0, 40)}`);
        break;
      default:
        this.warnings.push(`Unknown TSPL command: ${cmd}`);
    }
  }

  private pushMeasurePair(kind: "gap" | "bline", line: string): void {
    const pair = parseMeasurePair(line);
    const unit: TsplUnit =
      pair.first.unit !== "dot" ? pair.first.unit : pair.second.unit !== "dot" ? pair.second.unit : "inch";
    this.commands.push({
      kind,
      value: pair.first.value,
      sensorOffset: pair.second.value,
      unit,
    });
  }

  private parseSize(line: string): void {
    const body = line.replace(/^SIZE\s+/i, "");
    const parts = body.split(",").map((p) => p.trim());
    if (parts.length < 2) return;

    const wMatch = parts[0]!.match(/^([\d.]+)\s*(\w*)/);
    const hMatch = parts[1]!.match(/^([\d.]+)\s*(\w*)/);
    const wVal = parseNumber(wMatch?.[1]);
    const hVal = parseNumber(hMatch?.[1]);
    const wUnit = parseUnit(wMatch?.[2] || parts[0]);
    const hUnit = parseUnit(hMatch?.[2] || parts[1]);
    const unit: TsplUnit = wUnit !== "dot" ? wUnit : hUnit;

    this.commands.push({ kind: "size", width: wVal, height: hVal, unit });
  }

  private parseText(line: string, tokens: string[]): void {
    const quoted = extractQuotedStrings(line);
    const content = quoted.length > 0 ? quoted[quoted.length - 1]! : "";
    this.commands.push({
      kind: "text",
      x: parseNumber(tokens[1]),
      y: parseNumber(tokens[2]),
      font: unquote(tokens[3] ?? "0"),
      rotation: parseNumber(tokens[4]),
      xMul: parseNumber(tokens[5]) || 1,
      yMul: parseNumber(tokens[6]) || 1,
      content,
    });
  }

  private parseBlock(line: string, tokens: string[]): void {
    const quoted = extractQuotedStrings(line);
    const content = quoted.length > 0 ? quoted[quoted.length - 1]! : "";
    this.commands.push({
      kind: "block",
      x: parseNumber(tokens[1]),
      y: parseNumber(tokens[2]),
      width: parseNumber(tokens[3]),
      height: parseNumber(tokens[4]),
      font: unquote(tokens[5] ?? "0"),
      rotation: parseNumber(tokens[6]),
      xMul: parseNumber(tokens[7]) || 1,
      yMul: parseNumber(tokens[8]) || 1,
      content,
    });
  }

  private parseBarcode(line: string, tokens: string[]): void {
    const quoted = extractQuotedStrings(line);
    const data = quoted.length >= 2 ? quoted[quoted.length - 1]! : quoted[0] ?? "";
    this.commands.push({
      kind: "barcode",
      x: parseNumber(tokens[1]),
      y: parseNumber(tokens[2]),
      format: (tokens[3] ?? "128").replace(/"/g, ""),
      height: parseNumber(tokens[4]) || 40,
      readable: parseNumber(tokens[5]) || 1,
      rotation: parseNumber(tokens[6]) || 0,
      narrow: parseNumber(tokens[7]) || 2,
      wide: parseNumber(tokens[8]) || 4,
      data,
    });
  }

  private parseQrcode(line: string, tokens: string[]): void {
    const quoted = extractQuotedStrings(line);
    const data = quoted[0] ?? "";
    this.commands.push({
      kind: "qrcode",
      x: parseNumber(tokens[1]),
      y: parseNumber(tokens[2]),
      ecLevel: (tokens[3] ?? "M").replace(/"/g, ""),
      cellWidth: parseNumber(tokens[4]) || 4,
      mode: (tokens[5] ?? "A").replace(/"/g, ""),
      data,
    });
  }
}
