import { parseEscPosInspector, type ParsedCommand } from "@virt-printer/escpos";
import { isTsplPayload, parseTspl, type TsplParsedCommand } from "@virt-printer/tspl";

export type InspectorBlockKind = "setup" | "drawable" | "composite";

export interface InspectorRowView {
  commandId: string;
  index: number;
  category: string;
  label: string;
  offset: number;
  length: number;
  detail: string;
  previewable: boolean;
}

export interface InspectorBlock {
  id: string;
  kind: InspectorBlockKind;
  title: string;
  detail: string;
  previewable: boolean;
  highlightId: string | null;
  commandIds: string[];
  rows: InspectorRowView[];
}

const TSPL_META = new Set([
  "size",
  "gap",
  "bline",
  "direction",
  "reference",
  "offset",
  "shift",
  "speed",
  "density",
  "feed",
  "backfeed",
  "formfeed",
  "cls",
  "print",
  "home",
  "fileRef",
  "codepage",
]);

const ESCPOS_DRAWABLE = new Set(["text", "image", "rasterImage", "barcode", "qrCode"]);
const ESCPOS_STATE = new Set(["alignment", "font", "style", "codePage"]);
const ESCPOS_META = new Set(["initialize", "cut", "cashDrawer", "unsupported"]);
const ESCPOS_LAYOUT = new Set(["feed", "lineFeed", "lineSpacing"]);

function escposDetail(cmd: ParsedCommand): string {
  switch (cmd.category) {
    case "text":
      return cmd.text;
    case "qrCode":
      return cmd.data;
    case "barcode":
      return `${cmd.symbology} · ${cmd.data}`;
    case "image":
    case "rasterImage":
      return `${cmd.width}×${cmd.height} · ${cmd.mode}`;
    case "unsupported":
      return cmd.reason;
    default:
      return cmd.description;
  }
}

function tsplDetail(cmd: TsplParsedCommand): string {
  switch (cmd.kind) {
    case "text":
      return cmd.content;
    case "barcode":
      return `${cmd.format} · ${cmd.data}`;
    case "qrcode":
      return cmd.data;
    case "size":
      return `${cmd.width}×${cmd.height} ${cmd.unit}`;
    case "bitmap":
      return `${cmd.width}×${cmd.height} dots`;
    case "fileRef":
      return `${cmd.format}: ${cmd.filename}`;
    case "codepage":
      return cmd.name;
    default:
      return cmd.kind;
  }
}

function setupBlock(id: string, rows: InspectorRowView[]): InspectorBlock {
  return {
    id,
    kind: "setup",
    title: rows.length === 1 ? rows[0]!.label : `Setup · ${rows.length} commands`,
    detail: rows.length === 1 ? rows[0]!.detail : "",
    previewable: false,
    highlightId: null,
    commandIds: rows.map((r) => r.commandId),
    rows,
  };
}

function drawableBlock(row: InspectorRowView, title?: string): InspectorBlock {
  return {
    id: `block-${row.commandId}`,
    kind: "drawable",
    title: title ?? row.label,
    detail: row.detail,
    previewable: true,
    highlightId: row.commandId,
    commandIds: [row.commandId],
    rows: [row],
  };
}

function compositeBlock(
  id: string,
  title: string,
  detail: string,
  highlightId: string,
  rows: InspectorRowView[],
): InspectorBlock {
  return {
    id,
    kind: "composite",
    title,
    detail,
    previewable: true,
    highlightId,
    commandIds: rows.map((r) => r.commandId),
    rows,
  };
}

export function buildEscPosBlocks(rows: InspectorRowView[], commands: ParsedCommand[]): InspectorBlock[] {
  const blocks: InspectorBlock[] = [];
  let i = 0;
  let pendingState: InspectorRowView[] = [];

  function flushPendingState() {
    if (pendingState.length === 0) return;
    blocks.push(setupBlock(`block-orphan-state-${pendingState[0]!.commandId}`, pendingState));
    pendingState = [];
  }

  while (i < rows.length) {
    const cmd = commands[i];
    const row = rows[i]!;
    if (!cmd) break;

    if (cmd.category === "qrCode") {
      flushPendingState();
      const start = i;
      while (i < commands.length && commands[i]?.category === "qrCode") i += 1;
      const group = rows.slice(start, i);
      const print = group.find((r) => r.label === "Print QR Code") ?? group[group.length - 1]!;
      const data = group.find((r) => r.label === "QR Code" && r.detail);
      blocks.push(
        compositeBlock(
          `block-qr-${start}`,
          "QR Code",
          data?.detail || print.detail || "Print QR",
          print.commandId,
          group,
        ),
      );
      continue;
    }

    if (cmd.category === "barcode") {
      flushPendingState();
      let groupStart = i;
      while (groupStart > 0 && commands[groupStart - 1]?.category === "style") {
        groupStart -= 1;
      }
      const group = rows.slice(groupStart, i + 1);
      pendingState = pendingState.filter((r) => !group.slice(0, -1).some((g) => g.commandId === r.commandId));
      blocks.push(
        compositeBlock(`block-bc-${groupStart}`, "Barcode", row.detail, row.commandId, group),
      );
      i += 1;
      continue;
    }

    if (ESCPOS_DRAWABLE.has(cmd.category)) {
      const prefix = [...pendingState];
      pendingState = [];
      const title =
        cmd.category === "text" ? "Text" : cmd.category === "rasterImage" ? "Raster image" : row.label;
      if (prefix.length > 0) {
        blocks.push(compositeBlock(`block-line-${i}`, title, row.detail, row.commandId, [...prefix, row]));
      } else {
        blocks.push(drawableBlock(row, title));
      }
      i += 1;
      continue;
    }

    if (ESCPOS_STATE.has(cmd.category)) {
      pendingState.push(row);
      i += 1;
      continue;
    }

    if (ESCPOS_LAYOUT.has(cmd.category)) {
      flushPendingState();
      blocks.push(drawableBlock(row));
      i += 1;
      continue;
    }

    if (ESCPOS_META.has(cmd.category)) {
      flushPendingState();
      const start = i;
      while (i < commands.length && ESCPOS_META.has(commands[i]!.category)) i += 1;
      blocks.push(setupBlock(`block-setup-${start}`, rows.slice(start, i)));
      continue;
    }

    flushPendingState();
    blocks.push(setupBlock(`block-misc-${i}`, [row]));
    i += 1;
  }

  flushPendingState();
  return blocks;
}

export function buildTsplBlocks(rows: InspectorRowView[], commands: TsplParsedCommand[]): InspectorBlock[] {
  const blocks: InspectorBlock[] = [];
  let i = 0;

  while (i < rows.length) {
    const cmd = commands[i];
    const row = rows[i]!;
    if (!cmd) break;

    if (TSPL_META.has(cmd.kind)) {
      const start = i;
      while (i < commands.length && TSPL_META.has(commands[i]!.kind)) i += 1;
      blocks.push(setupBlock(`block-setup-${start}`, rows.slice(start, i)));
      continue;
    }

    const next = commands[i + 1];
    if (
      cmd.kind === "reverse" &&
      next?.kind === "text" &&
      next.y >= cmd.y &&
      next.y <= cmd.y + cmd.height
    ) {
      blocks.push(
        compositeBlock(
          `block-strip-${i}`,
          "Reverse strip",
          next.content,
          row.commandId,
          [row, rows[i + 1]!],
        ),
      );
      i += 2;
      continue;
    }

    blocks.push(drawableBlock(row));
    i += 1;
  }

  return blocks;
}

export function buildInspectorBlocks(payload: Uint8Array, protocol: string): InspectorBlock[] {
  const tspl = protocol === "tspl" || isTsplPayload(payload);
  if (tspl) {
    const { commands } = parseTspl(payload);
    const rows: InspectorRowView[] = commands.map((cmd, index) => ({
      commandId: `tspl-${index}`,
      index: index + 1,
      category: cmd.kind,
      label: cmd.kind.toUpperCase(),
      offset: cmd.span.offset,
      length: cmd.span.length,
      detail: tsplDetail(cmd),
      previewable: !TSPL_META.has(cmd.kind),
    }));
    return buildTsplBlocks(rows, commands);
  }

  const { commands } = parseEscPosInspector(payload);
  const rows: InspectorRowView[] = commands.map((cmd) => ({
    commandId: cmd.id,
    index: cmd.index,
    category: cmd.category,
    label: cmd.label,
    offset: cmd.span.offset,
    length: cmd.span.length,
    detail: escposDetail(cmd),
    previewable: ESCPOS_DRAWABLE.has(cmd.category) || ESCPOS_LAYOUT.has(cmd.category),
  }));
  return buildEscPosBlocks(rows, commands);
}
