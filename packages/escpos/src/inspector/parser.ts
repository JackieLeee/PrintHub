import {
  BARCODE_TYPES,
  QR_ERROR_CORRECTION,
  bytesToHex,
  isTextByte,
} from "./utils.js";
import {
  decodeEscStarStripes,
  decodeGsV0Image,
  estimatePaperWidthFromImage,
} from "./decode-image.js";
import type { EscStarBand } from "./decode-image.js";
import type {
  AlignmentCommand,
  BarcodeCommand,
  BaseCommand,
  CommandCategory,
  CashDrawerCommand,
  CodePageCommand,
  CutCommand,
  FeedCommand,
  FontCommand,
  ImageCommand,
  LineSpacingCommand,
  ParseResult,
  ParsedCommand,
  QrCodeCommand,
  StyleCommand,
  TextCommand,
  UnsupportedCommand,
} from "./types.js";
import { decodeTextBytes, codePageName, hriFromCode, symbologyFromGsK } from "../encoding.js";
import { inferPaperWidthFromCommands } from "../paper-width.js";

// we keep track of the current printer state while we walk the bytes.
// escpos is stateful, so a command like "bold on" stays active untill
// something turns it off again.
interface ParserState {
  charWidth: number;
  charHeight: number;
  bold: boolean;
  underline: boolean;
  doubleStrike: boolean;
  invert: boolean;
  alignment: "left" | "center" | "right";
  utf8: boolean;
  codePage: string;
  chineseMode: boolean;
  cellWidthScale: number;
  barcodeHeight: number;
  barcodeWidth: number;
  barcodeHri: BarcodeCommand["position"];
}

function makeId(index: number): string {
  return `cmd-${index}`;
}

function sliceHex(data: Uint8Array, start: number, end: number): string {
  return bytesToHex(data.subarray(start, end));
}

// small helper so every command looks the same. it also stores the raw hex
// and the span (offset + length) so the ui can jump to the right bytes later.
function baseCommand<C extends CommandCategory>(
  index: number,
  category: C,
  label: string,
  description: string,
  start: number,
  end: number,
  data: Uint8Array,
  previewable = true,
): BaseCommand & { category: C } {
  return {
    id: makeId(index),
    index,
    category,
    label,
    description,
    span: { offset: start, length: end - start },
    previewable,
    rawHex: sliceHex(data, start, end),
  };
}

function alignmentLabel(value: number): AlignmentCommand["alignment"] {
  if (value === 1) return "center";
  if (value === 2) return "right";
  return "left";
}

// main entry point. it reads the stream byte by byte from start to end.
// the big while loop below is basicly one giant switch on the first byte,
// if you want to add a new command just add another branch, nothing else
// in the app needs to change.
export function parseEscPosInspector(data: Uint8Array, paperWidth = 384): ParseResult {
  const commands: ParsedCommand[] = [];
  const warnings: string[] = [];
  let index = 0;
  let commandIndex = 0;
  // we try to guess the paper width from the biggest image we find.
  let detectedWidth = paperWidth;

  const state: ParserState = {
    charWidth: 1,
    charHeight: 1,
    bold: false,
    underline: false,
    doubleStrike: false,
    invert: false,
    alignment: "left",
    utf8: false,
    codePage: "cp936",
    chineseMode: false,
    cellWidthScale: 1,
    barcodeHeight: 80,
    barcodeWidth: 2,
    barcodeHri: "below",
  };

  const push = (command: ParsedCommand) => {
    commands.push(command);
    commandIndex += 1;
  };

  while (index < data.length) {
    const start = index;
    const byte = data[index]!;

    // 0x1b is ESC. most style/layout commands start with this one.
    if (byte === 0x1b) {
      if (index + 1 >= data.length) {
        push({
          ...baseCommand(
            commandIndex,
            "unsupported",
            "Incomplete ESC Sequence",
            "Truncated ESC command",
            start,
            data.length,
            data,
            false,
          ),
          reason: "Stream ended after ESC",
        } as UnsupportedCommand);
        break;
      }

      const next = data[index + 1]!;

      if (next === 0x40) {
        state.charWidth = 1;
        state.charHeight = 1;
        state.bold = false;
        state.underline = false;
        state.doubleStrike = false;
        state.invert = false;
        state.alignment = "left";
        state.utf8 = false;
        state.codePage = "cp936";
        state.chineseMode = false;
        state.cellWidthScale = 1;
        state.barcodeHeight = 80;
        state.barcodeWidth = 2;
        state.barcodeHri = "below";
        index += 2;
        push({
          ...baseCommand(
            commandIndex,
            "initialize",
            "Initialize Printer",
            "ESC @ ; reset printer to defaults",
            start,
            index,
            data,
          ),
        });
        continue;
      }

      if (next === 0x61 && index + 2 < data.length) {
        const value = data[index + 2]!;
        state.alignment = alignmentLabel(value);
        index += 3;
        push({
          ...baseCommand(
            commandIndex,
            "alignment",
            "Alignment",
            `Set alignment to ${state.alignment}`,
            start,
            index,
            data,
          ),
          alignment: state.alignment,
        } as AlignmentCommand);
        continue;
      }

      if (next === 0x21 && index + 2 < data.length) {
        const value = data[index + 2]!;
        const bold = (value & 0x08) !== 0;
        const doubleHeight = (value & 0x10) !== 0;
        const doubleWidth = (value & 0x20) !== 0;
        const underline = (value & 0x80) !== 0;
        state.bold = bold;
        state.underline = underline;
        state.charWidth = doubleWidth ? 2 : 1;
        state.charHeight = doubleHeight ? 2 : 1;
        index += 3;
        push({
          ...baseCommand(
            commandIndex,
            "font",
            "Font / Print Mode",
            `ESC ! ; bold=${bold}, underline=${underline}, width×${state.charWidth}, height×${state.charHeight}`,
            start,
            index,
            data,
            false,
          ),
          width: state.charWidth,
          height: state.charHeight,
          bold,
          underline,
          cellWidthScale: state.cellWidthScale,
        } as FontCommand);
        continue;
      }

      if (next === 0x45 && index + 2 < data.length) {
        state.bold = data[index + 2]! !== 0;
        index += 3;
        push({
          ...baseCommand(
            commandIndex,
            "style",
            "Bold",
            state.bold ? "Bold on" : "Bold off",
            start,
            index,
            data,
            false,
          ),
          bold: state.bold,
        } as StyleCommand);
        continue;
      }

      if (next === 0x2d && index + 2 < data.length) {
        state.underline = data[index + 2]! > 0;
        index += 3;
        push({
          ...baseCommand(
            commandIndex,
            "style",
            "Underline",
            state.underline ? "Underline on" : "Underline off",
            start,
            index,
            data,
            false,
          ),
          underline: state.underline,
        } as StyleCommand);
        continue;
      }

      if (next === 0x64 && index + 2 < data.length) {
        const lines = data[index + 2]!;
        index += 3;
        push({
          ...baseCommand(
            commandIndex,
            "feed",
            "Feed Lines",
            `Feed ${lines} line(s)`,
            start,
            index,
            data,
            lines > 0,
          ),
          lines,
          unit: "lines",
        } as FeedCommand);
        continue;
      }

      if (next === 0x69) {
        index += 2;
        push({
          ...baseCommand(
            commandIndex,
            "cut",
            "Cut Paper",
            "ESC i ; full cut",
            start,
            index,
            data,
          ),
          mode: "full",
        } as CutCommand);
        continue;
      }

      if (next === 0x6d) {
        index += 2;
        push({
          ...baseCommand(
            commandIndex,
            "cut",
            "Cut Paper",
            "ESC m ; partial cut",
            start,
            index,
            data,
          ),
          mode: "partial",
        } as CutCommand);
        continue;
      }

      // ESC 3 n sets the line spacing (in dots).
      // ESC 3 24 before the image so the 24-dot stripes butt together with
      // no gap. it only changes feed distance, so there is nothing to draw.
      if (next === 0x33 && index + 2 < data.length) {
        const spacing = data[index + 2]!;
        index += 3;
        push({
          ...baseCommand(
            commandIndex,
            "lineSpacing",
            "Line Spacing",
            `ESC 3 ; line spacing = ${spacing} dot(s)`,
            start,
            index,
            data,
            false,
          ),
          spacing,
        } as LineSpacingCommand);
        continue;
      }

      // ESC 2 restores the default line spacing (sent after the image run).
      if (next === 0x32) {
        index += 2;
        push({
          ...baseCommand(
            commandIndex,
            "lineSpacing",
            "Line Spacing",
            "ESC 2 ; restore default line spacing",
            start,
            index,
            data,
            false,
          ),
          spacing: null,
        } as LineSpacingCommand);
        continue;
      }

      // ESC * is a column-format bit image. the cashier app emits a tall
      // picture as a run of stripes (ESC * m nL nH <data> LF), each 8 or 24
      // dots tall, that butt together. we swallow the whole consecutive run
      // here and rebuild it into a single image. nL/nH is the width in DOTS
      // (little-endian) and the data is width * bytesPerColumn bytes.
      if (next === 0x2a) {
        const bands: EscStarBand[] = [];
        let cursor = index;
        let truncated = false;

        while (
          cursor + 1 < data.length &&
          data[cursor] === 0x1b &&
          data[cursor + 1] === 0x2a
        ) {
          if (cursor + 5 > data.length) {
            truncated = true;
            break;
          }
          const mode = data[cursor + 2]!;
          const width = data[cursor + 3]! + data[cursor + 4]! * 256;
          const bytesPerColumn = mode === 32 || mode === 33 ? 3 : 1;
          const heightDots = mode === 32 || mode === 33 ? 24 : 8;
          const dataStart = cursor + 5;
          const expectedLen = width * bytesPerColumn;
          const scanUntil = Math.min(dataStart + expectedLen, data.length);

          let stripeEnd = dataStart;
          while (stripeEnd < scanUntil && data[stripeEnd] !== 0x0a) {
            stripeEnd += 1;
          }

          const copiedLen = stripeEnd - dataStart;
          if (copiedLen === 0) {
            truncated = true;
            break;
          }

          const stripeBytes = new Uint8Array(expectedLen);
          stripeBytes.set(data.subarray(dataStart, stripeEnd));
          bands.push({
            mode,
            width,
            heightDots,
            data: stripeBytes,
          });

          if (stripeEnd < data.length && data[stripeEnd] === 0x0a) {
            cursor = stripeEnd + 1;
          } else if (copiedLen < expectedLen) {
            truncated = true;
            break;
          } else {
            cursor = stripeEnd;
            truncated = true;
            break;
          }
        }

        if (bands.length === 0) {
          push({
            ...baseCommand(
              commandIndex,
              "unsupported",
              "Incomplete Image",
              "ESC * image data truncated",
              start,
              data.length,
              data,
            ),
            reason: "Expected ESC * stripe data",
          } as UnsupportedCommand);
          break;
        }

        const decoded = decodeEscStarStripes(bands);
        if (decoded.height <= 0) {
          index = cursor;
          continue;
        }
        detectedWidth = Math.max(
          detectedWidth,
          estimatePaperWidthFromImage(decoded.width),
        );
        index = cursor;
        push({
          ...baseCommand(
            commandIndex,
            "image",
            "Bit Image",
            `${decoded.mode}, ${decoded.width}×${decoded.height}px`,
            start,
            index,
            data,
          ),
          ...decoded,
        } as ImageCommand);

        if (truncated) {
          warnings.push(
            "ESC * image stream ended mid-stripe; the image may be incomplete.",
          );
        }
        continue;
      }

      // ESC J n prints and feeds n dots. the new contract ends jobs with
      // ESC d instead, but we still decode ESC J so legacy streams read back
      // cleanly in the inspector.
      if (next === 0x4a && index + 2 < data.length) {
        const units = data[index + 2]!;
        index += 3;
        push({
          ...baseCommand(
            commandIndex,
            "feed",
            "Feed Units",
            `Feed ${units} dot(s)`,
            start,
            index,
            data,
            units > 0,
          ),
          lines: units,
          unit: "dots",
        } as FeedCommand);
        continue;
      }

      if (next === 0x70 && index + 4 < data.length) {
        const pin = data[index + 2]!;
        const pulseOn = data[index + 3]!;
        const pulseOff = data[index + 4]!;
        index += 5;
        push({
          ...baseCommand(
            commandIndex,
            "cashDrawer",
            "Cash Drawer",
            `ESC p ; pin=${pin}, t1=${pulseOn}, t2=${pulseOff}`,
            start,
            index,
            data,
          ),
          pin,
          pulseOn,
          pulseOff,
        } as CashDrawerCommand);
        continue;
      }

      if (next === 0x74 && index + 2 < data.length) {
        const code = data[index + 2]!;
        const pageName = codePageName(code);
        state.codePage = pageName;
        state.utf8 = code === 255;
        index += 3;
        push({
          ...baseCommand(
            commandIndex,
            "codePage",
            "Code Page",
            `ESC t ; ${pageName} (n=${code})`,
            start,
            index,
            data,
            false,
          ),
          code,
          pageName,
        } as CodePageCommand);
        continue;
      }

      if (next === 0x4d && index + 2 < data.length) {
        const font = data[index + 2]!;
        state.cellWidthScale = font === 1 || font === 49 ? 9 / 12 : 1;
        index += 3;
        push({
          ...baseCommand(
            commandIndex,
            "font",
            "Select Font",
            `ESC M ; font ${font === 0 || font === 48 ? "A" : font === 1 || font === 49 ? "B" : String(font)}`,
            start,
            index,
            data,
            false,
          ),
          width: state.charWidth,
          height: state.charHeight,
          bold: state.bold,
          underline: state.underline,
          cellWidthScale: state.cellWidthScale,
        } as FontCommand);
        continue;
      }

      if (next === 0x47) {
        state.doubleStrike = true;
        index += 2;
        push({
          ...baseCommand(
            commandIndex,
            "style",
            "Double Strike",
            "ESC G ; double-strike on",
            start,
            index,
            data,
            false,
          ),
          doubleStrike: true,
        } as StyleCommand);
        continue;
      }

      if (next === 0x48) {
        state.doubleStrike = false;
        index += 2;
        push({
          ...baseCommand(
            commandIndex,
            "style",
            "Double Strike",
            "ESC H ; double-strike off",
            start,
            index,
            data,
            false,
          ),
          doubleStrike: false,
        } as StyleCommand);
        continue;
      }

      index += 2;
      push({
        ...baseCommand(
          commandIndex,
          "unsupported",
          "Unsupported ESC Command",
          `ESC ${next.toString(16).padStart(2, "0").toUpperCase()}`,
          start,
          index,
          data,
          false,
        ),
        reason: `Unknown ESC sequence ESC ${next.toString(16).padStart(2, "0").toUpperCase()}`,
      } as UnsupportedCommand);
      continue;
    }

    // 0x1d is GS. images, qr codes, barcodes and the cut command live here.
    if (byte === 0x1d) {
      if (index + 1 >= data.length) {
        push({
          ...baseCommand(
            commandIndex,
            "unsupported",
            "Incomplete GS Sequence",
            "Truncated GS command",
            start,
            data.length,
            data,
            false,
          ),
          reason: "Stream ended after GS",
        } as UnsupportedCommand);
        break;
      }

      const next = data[index + 1]!;

      if (next === 0x21 && index + 2 < data.length) {
        const value = data[index + 2]!;
        const width = ((value >> 4) & 0x07) + 1;
        const height = (value & 0x07) + 1;
        state.charWidth = width;
        state.charHeight = height;
        index += 3;
        push({
          ...baseCommand(
            commandIndex,
            "font",
            "Font Size",
            `GS ! ; character size ${width}×${height}`,
            start,
            index,
            data,
            false,
          ),
          width,
          height,
          bold: state.bold,
          underline: state.underline,
          cellWidthScale: state.cellWidthScale,
        } as FontCommand);
        continue;
      }

      if (next === 0x42 && index + 2 < data.length) {
        const n = data[index + 2]!;
        state.invert = n === 1 || n === 0x31;
        index += 3;
        push({
          ...baseCommand(
            commandIndex,
            "style",
            "Invert Print",
            state.invert ? "GS B ; inverted (white on black)" : "GS B ; normal",
            start,
            index,
            data,
            false,
          ),
          invert: state.invert,
        } as StyleCommand);
        continue;
      }

      if (next === 0x68 && index + 2 < data.length) {
        state.barcodeHeight = data[index + 2]!;
        index += 3;
        continue;
      }

      if (next === 0x77 && index + 2 < data.length) {
        state.barcodeWidth = data[index + 2]!;
        index += 3;
        continue;
      }

      if (next === 0x48 && index + 2 < data.length) {
        state.barcodeHri = hriFromCode(data[index + 2]!);
        index += 3;
        continue;
      }

      // GS V (paper cut) and GS v 0 (row-major raster image) are no longer
      // emitted by the cashier app, which now ends jobs with ESC d and sends
      // images as ESC * column stripes. we still decode them both so older /
      // third-party streams remain fully readable in the inspector.
      if (next === 0x56 && index + 2 < data.length) {
        const mode = data[index + 2]!;
        const cutMode: CutCommand["mode"] =
          mode === 0 || mode === 48 ? "full" : "partial";
        const end =
          mode === 66 && index + 3 < data.length ? index + 4 : index + 3;
        index = end;
        push({
          ...baseCommand(
            commandIndex,
            "cut",
            "Cut Paper",
            `GS V ; ${cutMode} cut`,
            start,
            index,
            data,
          ),
          mode: cutMode,
        } as CutCommand);
        continue;
      }

      // GS v 0 is the row-major raster image: width is in bytes (×8 for the
      // pixel width) and the MSB of a byte is the leftmost pixel ; the opposite
      // packing to the column-format ESC * stripes above.
      if (
        next === 0x76 &&
        index + 2 < data.length &&
        data[index + 2] === 0x30
      ) {
        if (index + 7 >= data.length) {
          push({
            ...baseCommand(
              commandIndex,
              "unsupported",
              "Incomplete Raster Image",
              "GS v 0 data truncated",
              start,
              data.length,
              data,
            ),
            reason: "Missing raster header bytes",
          } as UnsupportedCommand);
          break;
        }

        const mode = data[index + 3]!;
        const xL = data[index + 4]!;
        const xH = data[index + 5]!;
        const yL = data[index + 6]!;
        const yH = data[index + 7]!;
        const widthBytes = xL + xH * 256;
        const height = yL + yH * 256;
        const widthPx = widthBytes * 8;
        const imageBytes = widthBytes * height;
        const end = index + 8 + imageBytes;

        if (end > data.length) {
          push({
            ...baseCommand(
              commandIndex,
              "unsupported",
              "Incomplete Raster Image",
              "GS v 0 image data truncated",
              start,
              data.length,
              data,
            ),
            reason: `Expected ${imageBytes} raster bytes`,
          } as UnsupportedCommand);
          break;
        }

        const imageData = data.subarray(index + 8, end);
        const decoded = decodeGsV0Image(mode, widthPx, height, imageData);
        if (decoded.height <= 0) {
          index = end;
          continue;
        }
        detectedWidth = Math.max(
          detectedWidth,
          estimatePaperWidthFromImage(decoded.width),
        );
        index = end;
        push({
          ...baseCommand(
            commandIndex,
            "rasterImage",
            "Raster Image",
            `${decoded.mode}, ${decoded.width}×${decoded.height}px, ${decoded.imageSize} bytes`,
            start,
            index,
            data,
          ),
          ...decoded,
        } as ImageCommand);
        continue;
      }

      if (next === 0x6b) {
        if (index + 2 >= data.length) break;
        const type = data[index + 2]!;

        if (type <= 6) {
          let j = index + 3;
          while (j < data.length && data[j] !== 0) j += 1;
          const payload = data.subarray(index + 3, j);
          const barcodeData = new TextDecoder("ascii").decode(payload);
          index = j + 1;
          push({
            ...baseCommand(
              commandIndex,
              "barcode",
              "Barcode",
              `${symbologyFromGsK(type)} ; ${barcodeData}`,
              start,
              index,
              data,
            ),
            symbology: symbologyFromGsK(type),
            data: barcodeData,
            height: state.barcodeHeight,
            width: state.barcodeWidth,
            position: state.barcodeHri,
          } as BarcodeCommand);
          continue;
        }

        if (type >= 0x41 && type <= 0x49) {
          if (index + 3 >= data.length) break;
          const len = data[index + 3]!;
          const dataStart = index + 4;
          const dataEnd = dataStart + len;
          if (dataEnd > data.length) {
            push({
              ...baseCommand(
                commandIndex,
                "unsupported",
                "Incomplete Barcode",
                "Barcode payload truncated",
                start,
                data.length,
                data,
              ),
              reason: "Missing barcode data",
            } as UnsupportedCommand);
            break;
          }
          const payload = data.subarray(dataStart, dataEnd);
          const barcodeData = new TextDecoder("ascii").decode(
            payload.length > 0 && payload[payload.length - 1] === 0
              ? payload.subarray(0, -1)
              : payload,
          );
          index = dataEnd;
          push({
            ...baseCommand(
              commandIndex,
              "barcode",
              "Barcode",
              `${BARCODE_TYPES[type] ?? "Unknown"} ; ${barcodeData}`,
              start,
              index,
              data,
            ),
            symbology: BARCODE_TYPES[type] ?? `Type 0x${type.toString(16)}`,
            data: barcodeData,
            height: state.barcodeHeight,
            width: state.barcodeWidth,
            position: state.barcodeHri,
          } as BarcodeCommand);
          continue;
        }
      }

      // GS ( k is the qr code family. it is not one command but many small
      // steps: set model, set size, set error level, store data, then print.
      // pL and pH give the length of the params as a little endian number.
      if (
        next === 0x28 &&
        index + 2 < data.length &&
        data[index + 2] === 0x6b
      ) {
        if (index + 7 > data.length) break;
        const pL = data[index + 3]!;
        const pH = data[index + 4]!;
        const paramLen = pL + pH * 256;
        const end = index + 5 + paramLen;

        if (end > data.length) {
          push({
            ...baseCommand(
              commandIndex,
              "unsupported",
              "Incomplete QR Command",
              "GS ( k payload truncated",
              start,
              data.length,
              data,
            ),
            reason: "QR parameter block incomplete",
          } as UnsupportedCommand);
          break;
        }

        const cn = data[index + 5]!;
        const fn = data[index + 6]!;

        if (cn !== 0x31) {
          index = end;
          push({
            ...baseCommand(
              commandIndex,
              "unsupported",
              "Graphics Command",
              `GS ( k cn 0x${cn.toString(16)}`,
              start,
              index,
              data,
              false,
            ),
            reason: `Unsupported cn value 0x${cn.toString(16)}`,
          } as UnsupportedCommand);
          continue;
        }

        if (fn === 0x41 && paramLen >= 3) {
          const rawModel = data[index + 7] ?? 50;
          const model =
            rawModel >= 0x30 && rawModel <= 0x39 ? rawModel - 0x30 : rawModel;
          index = end;
          push({
            ...baseCommand(
              commandIndex,
              "qrCode",
              "QR Model",
              `Model ${model}`,
              start,
              index,
              data,
              false,
            ),
            model,
            size: 3,
            errorCorrection: 0x31,
            data: "",
          } as QrCodeCommand);
          continue;
        }

        if (fn === 0x43 && paramLen >= 3) {
          const size = data[index + 7]!;
          index = end;
          push({
            ...baseCommand(
              commandIndex,
              "qrCode",
              "QR Code Size",
              `Module size ${size}`,
              start,
              index,
              data,
              false,
            ),
            model: 2,
            size,
            errorCorrection: 0x31,
            data: "",
          } as QrCodeCommand);
          continue;
        }

        if (fn === 0x45 && paramLen >= 3) {
          const ec = data[index + 7]!;
          index = end;
          push({
            ...baseCommand(
              commandIndex,
              "qrCode",
              "QR Error Correction",
              QR_ERROR_CORRECTION[ec] ?? `Level 0x${ec.toString(16)}`,
              start,
              index,
              data,
              false,
            ),
            model: 2,
            size: 3,
            errorCorrection: ec,
            data: "",
          } as QrCodeCommand);
          continue;
        }

        if (fn === 0x50 && paramLen >= 4) {
          const storeLen = paramLen - 3;
          const qrData = new TextDecoder("utf-8").decode(
            data.subarray(index + 8, index + 8 + storeLen),
          );
          index = end;
          push({
            ...baseCommand(
              commandIndex,
              "qrCode",
              "QR Code",
              `Store data (${qrData.length} chars)`,
              start,
              index,
              data,
            ),
            model: 2,
            size: 3,
            errorCorrection: 0x31,
            data: qrData,
          } as QrCodeCommand);
          continue;
        }

        if (fn === 0x51) {
          index = end;
          push({
            ...baseCommand(
              commandIndex,
              "qrCode",
              "Print QR Code",
              "Print stored QR symbol",
              start,
              index,
              data,
            ),
            model: 2,
            size: 3,
            errorCorrection: 0x31,
            data: "",
          } as QrCodeCommand);
          continue;
        }

        index = end;
        push({
          ...baseCommand(
            commandIndex,
            "unsupported",
            "QR Setup Command",
            `GS ( k function 0x${fn.toString(16)}`,
            start,
            index,
            data,
            false,
          ),
          reason: `Unhandled QR function 0x${fn.toString(16)}`,
        } as UnsupportedCommand);
        continue;
      }

      if (
        next === 0x28 &&
        index + 2 < data.length &&
        data[index + 2] === 0x4c
      ) {
        if (index + 6 >= data.length) break;
        const pL = data[index + 3]!;
        const pH = data[index + 4]!;
        const paramLen = pL + pH * 256;
        const end = index + 4 + paramLen;
        if (end > data.length) break;

        const fn = data[index + 5]!;
        if (fn === 0x70 && paramLen >= 10) {
          const xL = data[index + 6]!;
          const xH = data[index + 7]!;
          const yL = data[index + 8]!;
          const yH = data[index + 9]!;
          const widthBytes = xL + xH * 256;
          const height = yL + yH * 256;
          const widthPx = widthBytes * 8;
          const imageBytes = widthBytes * height;
          const imageStart = index + 10;
          const imageEnd = imageStart + imageBytes;
          if (imageEnd <= end) {
            const imageData = data.subarray(imageStart, imageEnd);
            const decoded = decodeGsV0Image(0, widthPx, height, imageData);
            if (decoded.height <= 0) {
              index = end;
              continue;
            }
            detectedWidth = Math.max(
              detectedWidth,
              estimatePaperWidthFromImage(decoded.width),
            );
            index = end;
            push({
              ...baseCommand(
                commandIndex,
                "rasterImage",
                "Raster Image (GS ( L)",
                `Graphics data ${decoded.width}×${decoded.height}px`,
                start,
                index,
                data,
              ),
              ...decoded,
              mode: "GS ( L graphics",
            } as ImageCommand);
            continue;
          }
        }

        index = end;
        push({
          ...baseCommand(
            commandIndex,
            "unsupported",
            "Graphics Command",
            `GS ( L function ${fn}`,
            start,
            index,
            data,
            false,
          ),
          reason: `Unhandled graphics function ${fn}`,
        } as UnsupportedCommand);
        continue;
      }

      index += 2;
      push({
        ...baseCommand(
          commandIndex,
          "unsupported",
          "Unsupported GS Command",
          `GS ${next.toString(16).padStart(2, "0").toUpperCase()}`,
          start,
          index,
          data,
          false,
        ),
        reason: `Unknown GS sequence GS ${next.toString(16).padStart(2, "0").toUpperCase()}`,
      } as UnsupportedCommand);
      continue;
    }

    if (byte === 0x0a) {
      index += 1;
      push({
        ...baseCommand(
          commandIndex,
          "lineFeed",
          "Line Feed",
          "LF ; advance one line",
          start,
          index,
          data,
        ),
      });
      continue;
    }

    if (byte === 0x0d) {
      index += 1;
      push({
        ...baseCommand(
          commandIndex,
          "lineFeed",
          "Carriage Return",
          "CR ; return carriage",
          start,
          index,
          data,
          false,
        ),
      });
      continue;
    }

    if (byte === 0x1c) {
      if (index + 1 >= data.length) {
        index += 1;
        continue;
      }
      const next = data[index + 1]!;
      if (next === 0x26) {
        state.utf8 = false;
        state.codePage = "gbk";
        state.chineseMode = true;
        index += 2;
        continue;
      }
      if (next === 0x2e) {
        state.utf8 = false;
        state.codePage = "cp437";
        state.chineseMode = false;
        index += 2;
        continue;
      }
    }

    // if it is not a control byte we treat it as text. we grab as many text
    // bytes as we can in one go so the ui shows a whole word/line insted of
    // one letter per row.
    if (isTextByte(byte)) {
      let end = index;
      while (
        end < data.length &&
        isTextByte(data[end]!) &&
        data[end]! !== 0x1b &&
        data[end]! !== 0x1d
      ) {
        end += 1;
      }
      const textBytes = data.subarray(index, end);
      const text = decodeTextBytes(textBytes, state.utf8, state.codePage, state.chineseMode);
      index = end;
      push({
        ...baseCommand(
          commandIndex,
          "text",
          "Text",
          text.length > 60 ? `${text.slice(0, 60)}…` : text,
          start,
          index,
          data,
        ),
        text,
      } as TextCommand);
      continue;
    }

    // we dont know what this byte is, but we never drop it silently. we keep
    // it as an "unknown byte" so the dev can still see the raw hex in the ui.
    index += 1;
    push({
      ...baseCommand(
        commandIndex,
        "unsupported",
        "Unknown Byte",
        `Unrecognized byte 0x${byte.toString(16).padStart(2, "0").toUpperCase()}`,
        start,
        index,
        data,
        false,
      ),
      reason: `Raw byte 0x${byte.toString(16).padStart(2, "0").toUpperCase()}`,
    } as UnsupportedCommand);
  }

  if (commands.length === 0) {
    warnings.push("No commands were decoded from the input stream.");
  }

  return {
    commands,
    warnings,
    paperWidth: inferPaperWidthFromCommands(commands, detectedWidth),
  };
}

export { bytesToHex } from "./utils.js";
