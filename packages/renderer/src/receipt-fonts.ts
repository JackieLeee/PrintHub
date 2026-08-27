/** Receipt text-mode font presets (preview / canvas renderer). */
export const RECEIPT_LATIN_FONT =
  '"IBM Plex Mono", "Noto Sans Mono", "Courier New", monospace';
export const RECEIPT_CJK_FONT = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

export const RECEIPT_FONT_PRESETS = [
  {
    id: "mono-thermal",
    label: "Mono Thermal",
    fontFamily: `${RECEIPT_LATIN_FONT}, ${RECEIPT_CJK_FONT}`,
  },
  {
    id: "system-ui",
    label: "System UI",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", sans-serif',
  },
  {
    id: "noto-clean",
    label: "Noto Clean",
    fontFamily: '"Noto Sans SC", "Noto Sans", sans-serif',
  },
  {
    id: "hei-gothic",
    label: "Hei Gothic",
    fontFamily:
      '"Microsoft YaHei", "PingFang SC", "Source Han Sans SC", "Helvetica Neue", sans-serif',
  },
  {
    id: "song-serif",
    label: "Song Serif",
    fontFamily: '"Songti SC", "SimSun", "STSong", serif',
  },
] as const;

export type ReceiptFontId = (typeof RECEIPT_FONT_PRESETS)[number]["id"];

/** User-facing preview cycle order (excludes legacy pos-sans). */
export const RECEIPT_FONT_PREVIEW_ORDER: ReceiptFontId[] = [
  "mono-thermal",
  "system-ui",
  "noto-clean",
  "hei-gothic",
  "song-serif",
];

export const DEFAULT_RECEIPT_FONT_ID: ReceiptFontId = "mono-thermal";

export function receiptFontFamily(id: string | undefined): string {
  const preset = RECEIPT_FONT_PRESETS.find((p) => p.id === id);
  return preset?.fontFamily ?? RECEIPT_FONT_PRESETS[0].fontFamily;
}

export function receiptFontLabel(id: string | undefined): string {
  const preset = RECEIPT_FONT_PRESETS.find((p) => p.id === id);
  return preset?.label ?? RECEIPT_FONT_PRESETS[0].label;
}

export function nextReceiptFontId(current: string): ReceiptFontId {
  const order = RECEIPT_FONT_PREVIEW_ORDER;
  const idx = order.indexOf(current as ReceiptFontId);
  const next = idx < 0 ? 0 : (idx + 1) % order.length;
  return order[next]!;
}

export function prevReceiptFontId(current: string): ReceiptFontId {
  const order = RECEIPT_FONT_PREVIEW_ORDER;
  const idx = order.indexOf(current as ReceiptFontId);
  const prev = idx <= 0 ? order.length - 1 : idx - 1;
  return order[prev]!;
}
