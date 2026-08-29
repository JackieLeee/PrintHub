export type TsplUnit = "mm" | "inch" | "dot";

export interface TsplCommandSpan {
  offset: number;
  length: number;
}

export type TsplCommand =
  | { kind: "size"; width: number; height: number; unit: TsplUnit }
  | { kind: "gap"; value: number; sensorOffset: number; unit: TsplUnit }
  | { kind: "bline"; value: number; sensorOffset: number; unit: TsplUnit }
  | { kind: "direction"; value: 0 | 1; mirror: 0 | 1 }
  | { kind: "reference"; x: number; y: number }
  /** Form-feed offset (peel/cutter stop adjustment), not x/y coordinates. */
  | { kind: "offset"; value: number; unit: TsplUnit }
  | { kind: "shift"; x: number; y: number }
  | { kind: "feed"; dots: number }
  | { kind: "backfeed"; dots: number }
  | { kind: "formfeed" }
  | { kind: "cls" }
  | { kind: "home" }
  | { kind: "text"; x: number; y: number; font: string; rotation: number; xMul: number; yMul: number; content: string }
  | {
      kind: "block";
      x: number;
      y: number;
      width: number;
      height: number;
      font: string;
      rotation: number;
      xMul: number;
      yMul: number;
      content: string;
    }
  | {
      kind: "barcode";
      x: number;
      y: number;
      format: string;
      height: number;
      readable: number;
      rotation: number;
      narrow: number;
      wide: number;
      data: string;
    }
  | { kind: "qrcode"; x: number; y: number; ecLevel: string; cellWidth: number; mode: string; data: string }
  | {
      kind: "bitmap";
      x: number;
      y: number;
      /** Row width in bytes (not dots). */
      width: number;
      /** Height in dots. */
      height: number;
      mode: number;
      data: Uint8Array;
    }
  | { kind: "box"; x: number; y: number; xEnd: number; yEnd: number; thickness: number; radius: number }
  | { kind: "bar"; x: number; y: number; width: number; height: number }
  | { kind: "circle"; x: number; y: number; diameter: number; thickness: number }
  | { kind: "ellipse"; x: number; y: number; width: number; height: number; thickness: number }
  | { kind: "reverse"; x: number; y: number; width: number; height: number }
  | { kind: "print"; copies: number; sets: number }
  | { kind: "speed"; ips: number }
  | { kind: "density"; level: number }
  | { kind: "fileRef"; format: "bmp" | "pcx"; filename: string }
  | { kind: "codepage"; name: string };

/** Parsed command with byte span in the original payload. */
export type TsplParsedCommand = TsplCommand & { span: TsplCommandSpan };

export interface TsplParseResult {
  commands: TsplParsedCommand[];
  warnings: string[];
}

export interface TsplLabelMeta {
  widthDots: number;
  heightDots: number;
  unit: TsplUnit;
  /** 0 = forward, 1 = backward (per TSC manual). */
  direction: 0 | 1;
  mirror: 0 | 1;
  reference: { x: number; y: number };
  shift: { x: number; y: number };
  gap: { valueDots: number; sensorOffsetDots: number } | null;
  feedOffsetDots: number;
  speed: number | null;
  density: number | null;
}

export function defaultLabelMeta(): TsplLabelMeta {
  return {
    widthDots: 40 * 8,
    heightDots: 30 * 8,
    unit: "mm",
    direction: 0,
    mirror: 0,
    reference: { x: 0, y: 0 },
    shift: { x: 0, y: 0 },
    gap: null,
    feedOffsetDots: 0,
    speed: null,
    density: null,
  };
}

/** TSC default: 203 dpi ≈ 8 dots/mm */
export const DOTS_PER_MM = 8;
export const DOTS_PER_INCH = 203;
