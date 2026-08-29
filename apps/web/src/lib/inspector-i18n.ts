import type { Translations } from "../i18n/types";
import type { InspectorBlock } from "./inspector-blocks";

type FormatFn = (template: string, vars: Record<string, string | number>) => string;

const BLOCK_TITLE_KEYS: Record<string, keyof Translations["inspector"]> = {
  Text: "blockText",
  "QR Code": "blockQrCode",
  Barcode: "blockBarcode",
  "Reverse strip": "blockReverseStrip",
  "Raster image": "blockRasterImage",
};

export function localizeBlockTitle(
  block: InspectorBlock,
  t: Translations["inspector"],
  format: FormatFn,
): string {
  if (block.kind === "setup" && block.rows.length > 1) {
    return format(t.setupMulti, { n: block.rows.length });
  }

  const mapped = BLOCK_TITLE_KEYS[block.title];
  if (mapped && t[mapped]) {
    return t[mapped] as string;
  }

  const category = block.rows[0]?.category;
  if (category && t.cmdCategory[category as keyof typeof t.cmdCategory]) {
    return t.cmdCategory[category as keyof typeof t.cmdCategory];
  }

  return block.title;
}

export function localizeRowLabel(
  category: string,
  label: string,
  t: Translations["inspector"],
): string {
  if (t.cmdCategory[category as keyof typeof t.cmdCategory]) {
    return t.cmdCategory[category as keyof typeof t.cmdCategory];
  }
  return label;
}
