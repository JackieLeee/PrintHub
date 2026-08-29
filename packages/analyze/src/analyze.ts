import { parseEscPosInspector, detectEscPosDialect, type EscPosDialect } from "@virt-printer/escpos";
import { isTsplPayload, parseTspl } from "@virt-printer/tspl";
import {
  buildInspectorBlocks,
  type InspectorBlock,
  type InspectorRowView,
} from "./blocks.js";

export const ANALYZE_SCHEMA_VERSION = 1 as const;

export interface AnalyzedCommand {
  id: string;
  index: number;
  category: string;
  label: string;
  offset: number;
  length: number;
  detail: string;
  previewable: boolean;
}

export interface PrintAnalysisSummary {
  categories: Record<string, number>;
  hasText: boolean;
  hasBarcode: boolean;
  hasQrCode: boolean;
  hasImage: boolean;
  hasRaster: boolean;
}

export interface PrintAnalysis {
  schemaVersion: typeof ANALYZE_SCHEMA_VERSION;
  protocol: "escpos" | "tspl";
  /** ESC/POS stream dialect when protocol is escpos. */
  dialect?: EscPosDialect;
  byteLength: number;
  paperWidth?: number;
  commandCount: number;
  unsupportedCount: number;
  unsupportedBytes: number;
  unsupportedByteRatio: number;
  warnings: string[];
  commands: AnalyzedCommand[];
  blocks: InspectorBlock[];
  summary: PrintAnalysisSummary;
}

export interface AnalyzeOptions {
  protocol?: "escpos" | "tspl" | "auto";
  paperWidth?: number;
}

function summarize(categories: Record<string, number>): PrintAnalysisSummary {
  return {
    categories,
    hasText: (categories.text ?? 0) > 0,
    hasBarcode: (categories.barcode ?? 0) > 0,
    hasQrCode: (categories.qrCode ?? 0) > 0 || (categories.qrcode ?? 0) > 0,
    hasImage: (categories.image ?? 0) > 0,
    hasRaster: (categories.rasterImage ?? 0) > 0 || (categories.bitmap ?? 0) > 0,
  };
}

function rowsFromEscPos(payload: Uint8Array, paperWidth?: number): {
  protocol: "escpos";
  commands: AnalyzedCommand[];
  warnings: string[];
  paperWidth?: number;
  unsupportedBytes: number;
} {
  const { commands, warnings, paperWidth: inferred } = parseEscPosInspector(payload, paperWidth);
  const categories: Record<string, number> = {};
  let unsupportedBytes = 0;
  const analyzed: AnalyzedCommand[] = commands.map((cmd) => {
    categories[cmd.category] = (categories[cmd.category] ?? 0) + 1;
    if (cmd.category === "unsupported") unsupportedBytes += cmd.span.length;
    return {
      id: cmd.id,
      index: cmd.index,
      category: cmd.category,
      label: cmd.label,
      offset: cmd.span.offset,
      length: cmd.span.length,
      detail:
        cmd.category === "text"
          ? cmd.text
          : cmd.category === "unsupported"
            ? cmd.reason
            : cmd.description,
      previewable: cmd.previewable,
    };
  });
  return {
    protocol: "escpos",
    commands: analyzed,
    warnings,
    paperWidth: paperWidth ?? inferred,
    unsupportedBytes,
  };
}

function rowsFromTspl(payload: Uint8Array): {
  protocol: "tspl";
  commands: AnalyzedCommand[];
  warnings: string[];
  unsupportedBytes: number;
} {
  const { commands, warnings } = parseTspl(payload);
  const analyzed: AnalyzedCommand[] = commands.map((cmd, index) => ({
    id: `tspl-${index}`,
    index: index + 1,
    category: cmd.kind,
    label: cmd.kind.toUpperCase(),
    offset: cmd.span.offset,
    length: cmd.span.length,
    detail:
      cmd.kind === "text"
        ? cmd.content
        : cmd.kind === "fileRef"
          ? `${cmd.format}: ${cmd.filename}`
          : cmd.kind,
    previewable: !["size", "gap", "cls", "print", "fileRef", "codepage"].includes(cmd.kind),
  }));
  return { protocol: "tspl", commands: analyzed, warnings, unsupportedBytes: 0 };
}

/** Agent-friendly structured analysis of a print payload (JSON-serializable). */
export function analyzePrintPayload(
  payload: Uint8Array,
  options: AnalyzeOptions = {},
): PrintAnalysis {
  const protocol =
    options.protocol && options.protocol !== "auto"
      ? options.protocol
      : isTsplPayload(payload)
        ? "tspl"
        : "escpos";

  const parsed =
    protocol === "tspl"
      ? rowsFromTspl(payload)
      : rowsFromEscPos(payload, options.paperWidth);

  const categories: Record<string, number> = {};
  for (const cmd of parsed.commands) {
    categories[cmd.category] = (categories[cmd.category] ?? 0) + 1;
  }

  const blocks = buildInspectorBlocks(payload, parsed.protocol);
  const unsupportedCount = categories.unsupported ?? 0;

  return {
    schemaVersion: ANALYZE_SCHEMA_VERSION,
    protocol: parsed.protocol,
    dialect: parsed.protocol === "escpos" ? detectEscPosDialect(payload) : undefined,
    byteLength: payload.length,
    paperWidth: "paperWidth" in parsed ? parsed.paperWidth : undefined,
    commandCount: parsed.commands.length,
    unsupportedCount,
    unsupportedBytes: parsed.unsupportedBytes,
    unsupportedByteRatio:
      payload.length > 0 ? Math.round((parsed.unsupportedBytes / payload.length) * 1000) / 1000 : 0,
    warnings: parsed.warnings,
    commands: parsed.commands,
    blocks,
    summary: summarize(categories),
  };
}

export type { InspectorBlock, InspectorRowView };
