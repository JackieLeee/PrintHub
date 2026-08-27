import type { ParsedCommand } from "./inspector/types.js";
import type { BarcodeSymbology, EscPosCommand, TextAlign } from "./types.js";

function qrEcFromByte(ec: number): string {
  const map: Record<number, string> = { 0x30: "L", 0x31: "M", 0x32: "Q", 0x33: "H" };
  return map[ec] ?? "M";
}

function mapSymbology(label: string): BarcodeSymbology {
  const s = label.toLowerCase();
  if (s.includes("upc-a") || s === "upca") return "upca";
  if (s.includes("upc-e") || s === "upce") return "upce";
  if (s.includes("ean13")) return "ean13";
  if (s.includes("ean8")) return "ean8";
  if (s.includes("code39")) return "code39";
  if (s.includes("itf")) return "itf";
  if (s.includes("codabar")) return "codabar";
  if (s.includes("code93")) return "code93";
  if (s.includes("gs1")) return "gs1-128";
  if (s.includes("128")) return "code128";
  return "unknown";
}

function mapHri(position: string): "none" | "above" | "below" | "both" {
  if (position === "above" || position === "1") return "above";
  if (position === "both" || position === "3") return "both";
  if (position === "none" || position === "0") return "none";
  return "below";
}

interface LegacyStyle {
  align: TextAlign;
  bold: boolean;
  underline: boolean;
  doubleWidth: boolean;
  doubleHeight: boolean;
  doubleStrike: boolean;
  font: "a" | "b";
}

function defaultStyle(): LegacyStyle {
  return {
    align: "left",
    bold: false,
    underline: false,
    doubleWidth: false,
    doubleHeight: false,
    doubleStrike: false,
    font: "a",
  };
}

/** Map inspector commands (preview path) to legacy EscPosCommand AST (tests/tools). */
export function mapInspectorToLegacy(commands: ParsedCommand[]): EscPosCommand[] {
  const out: EscPosCommand[] = [];
  const style = defaultStyle();
  let qrModel = 2;
  let qrSize = 3;
  let qrEc = "M";
  let qrData = "";

  for (const cmd of commands) {
    switch (cmd.category) {
      case "initialize":
        Object.assign(style, defaultStyle());
        break;
      case "alignment":
        style.align = cmd.alignment;
        break;
      case "font":
        style.bold = cmd.bold;
        style.underline = cmd.underline;
        style.doubleWidth = cmd.width > 1;
        style.doubleHeight = cmd.height > 1;
        if (cmd.cellWidthScale !== undefined) {
          style.font = cmd.cellWidthScale < 1 ? "b" : "a";
        }
        break;
      case "style":
        if (cmd.bold !== undefined) style.bold = cmd.bold;
        if (cmd.underline !== undefined) style.underline = cmd.underline;
        if (cmd.doubleStrike !== undefined) style.doubleStrike = cmd.doubleStrike;
        break;
      case "text": {
        let text = cmd.text;
        const endsWithLf = text.endsWith("\n");
        if (endsWithLf) text = text.slice(0, -1);
        if (text.length > 0) {
          out.push({
            kind: "text",
            text,
            align: style.align,
            bold: style.bold,
            underline: style.underline,
            doubleWidth: style.doubleWidth,
            doubleHeight: style.doubleHeight,
            doubleStrike: style.doubleStrike,
            font: style.font,
          });
        }
        if (endsWithLf) out.push({ kind: "line" });
        break;
      }
      case "lineFeed":
        out.push({ kind: "line" });
        break;
      case "feed":
        if (cmd.unit === "dots") out.push({ kind: "feedUnits", units: cmd.lines });
        else out.push({ kind: "feed", lines: cmd.lines });
        break;
      case "cut":
        out.push({ kind: "cut", mode: cmd.mode });
        break;
      case "barcode":
        out.push({
          kind: "barcode",
          symbology: mapSymbology(cmd.symbology),
          data: cmd.data,
          height: cmd.height,
          width: cmd.width,
          hri: mapHri(cmd.position),
        });
        break;
      case "qrCode":
        if (cmd.label === "QR Model" && cmd.model) qrModel = cmd.model;
        if (cmd.label === "QR Code Size" && cmd.size) qrSize = cmd.size;
        if (cmd.label === "QR Error Correction" && cmd.errorCorrection) {
          qrEc = qrEcFromByte(cmd.errorCorrection);
        }
        if (cmd.label === "QR Code" && cmd.data) qrData = cmd.data;
        if (cmd.label === "Print QR Code") {
          out.push({ kind: "qrcode", data: qrData, model: qrModel, size: qrSize, ecLevel: qrEc });
        }
        break;
      case "rasterImage":
        out.push({
          kind: "raster",
          widthBytes: Math.max(1, Math.ceil(cmd.width / 8)),
          height: cmd.height,
          mode: 0,
          data: new Uint8Array(Math.max(1, Math.ceil(cmd.width / 8)) * cmd.height),
        });
        break;
      case "image":
        out.push({
          kind: "bitImage",
          mode: 33,
          width: cmd.width,
          height: cmd.height,
          data: new Uint8Array(cmd.width * Math.max(1, Math.ceil(cmd.height / 24)) * 3),
        });
        break;
      default:
        break;
    }
  }

  return out;
}
