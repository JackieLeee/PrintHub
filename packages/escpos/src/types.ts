export type TextAlign = "left" | "center" | "right";

export type EscPosCommand =
  | {
      kind: "text";
      text: string;
      bold?: boolean;
      underline?: boolean;
      doubleWidth?: boolean;
      doubleHeight?: boolean;
      doubleStrike?: boolean;
      font?: "a" | "b";
      align?: TextAlign;
      codePage?: string;
    }
  | { kind: "line"; char?: string }
  | { kind: "align"; value: TextAlign }
  | { kind: "feed"; lines: number }
  | { kind: "feedUnits"; units: number }
  | { kind: "cut"; mode: "full" | "partial" }
  | { kind: "cashDrawer"; pin: number; pulseOn: number; pulseOff: number }
  | {
      kind: "barcode";
      symbology: BarcodeSymbology;
      data: string;
      height: number;
      width: number;
      hri: "none" | "above" | "below" | "both";
    }
  | { kind: "qrcode"; data: string; model: number; size: number; ecLevel: string }
  | { kind: "raster"; widthBytes: number; height: number; mode: number; data: Uint8Array }
  | { kind: "bitImage"; mode: number; width: number; height: number; data: Uint8Array }
  | {
      kind: "bitImageRun";
      width: number;
      totalHeight: number;
      bands: { mode: number; height: number; data: Uint8Array }[];
    }
  | { kind: "raw"; bytes: Uint8Array };

export type BarcodeSymbology =
  | "upca"
  | "upce"
  | "ean13"
  | "ean8"
  | "code39"
  | "itf"
  | "codabar"
  | "code93"
  | "code128"
  | "gs1-128"
  | "unknown";

export interface EscPosParseResult {
  commands: EscPosCommand[];
  warnings: string[];
}

export interface ParserState {
  align: TextAlign;
  bold: boolean;
  underline: boolean;
  doubleWidth: boolean;
  doubleHeight: boolean;
  doubleStrike: boolean;
  font: "a" | "b";
  codePage: string;
  utf8: boolean;
}

export function defaultParserState(): ParserState {
  return {
    align: "left",
    bold: false,
    underline: false,
    doubleWidth: false,
    doubleHeight: false,
    doubleStrike: false,
    font: "a",
    codePage: "gbk",
    utf8: false,
  };
}
