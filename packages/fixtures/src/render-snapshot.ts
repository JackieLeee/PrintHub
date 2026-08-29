import { createHash } from "node:crypto";
import { parseEscPosInspector } from "@virt-printer/escpos";
import { buildRenderElements, DEFAULT_RECEIPT_LAYOUT } from "@virt-printer/renderer";
import { parseTspl, resolveTsplLabelMeta, type TsplParsedCommand } from "@virt-printer/tspl";
import type { FixtureEntry } from "./index.js";

const TSPL_META_KINDS = new Set<TsplParsedCommand["kind"]>([
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
]);

function digest(obj: unknown): string {
  return createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 16);
}

function simplifyTspl(cmd: TsplParsedCommand): Record<string, unknown> {
  const base = { kind: cmd.kind, span: cmd.span };
  switch (cmd.kind) {
    case "text":
      return { ...base, x: cmd.x, y: cmd.y, content: cmd.content };
    case "barcode":
      return { ...base, x: cmd.x, y: cmd.y, format: cmd.format, data: cmd.data };
    case "qrcode":
      return { ...base, x: cmd.x, y: cmd.y, data: cmd.data };
    case "bitmap":
      return { ...base, x: cmd.x, y: cmd.y, w: cmd.width, h: cmd.height, bytes: cmd.data.length };
    case "box":
      return { ...base, x: cmd.x, y: cmd.y, xEnd: cmd.xEnd, yEnd: cmd.yEnd };
    default:
      return base;
  }
}

/** L4 layout fingerprint — deterministic render layout hash without headless PNG. */
export function renderFingerprint(entry: FixtureEntry, bytes: Uint8Array): string {
  if (entry.protocol === "tspl") {
    const { commands } = parseTspl(bytes);
    const meta = resolveTsplLabelMeta(commands);
    const drawable = commands.filter((c) => !TSPL_META_KINDS.has(c.kind)).map(simplifyTspl);
    return digest({
      widthDots: meta.widthDots,
      heightDots: meta.heightDots,
      drawable,
    });
  }

  const { commands, paperWidth } = parseEscPosInspector(bytes);
  const elements = buildRenderElements(commands, paperWidth, DEFAULT_RECEIPT_LAYOUT);
  const simplified = elements.map((e) => ({
    type: e.type,
    x: e.x ?? 0,
    y: Math.round(e.y),
    w: e.width ?? 0,
    h: Math.round(e.height),
    content: e.content?.slice(0, 48),
    align: e.alignment,
  }));
  return digest({ paperWidth, elements: simplified });
}
