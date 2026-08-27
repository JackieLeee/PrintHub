/** User-tunable text-mode receipt layout (preview UI). */
export interface ReceiptLayoutTuning {
  /** Scales drawn font height; column grid stays fixed to paper width. */
  fontSizeScale: number;
  /** Scales vertical gap between logical lines. */
  lineHeightScale: number;
}

export const DEFAULT_RECEIPT_LAYOUT: ReceiptLayoutTuning = {
  fontSizeScale: 2,
  lineHeightScale: 1.5,
};

export function normalizeReceiptLayout(partial?: Partial<ReceiptLayoutTuning>): ReceiptLayoutTuning {
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  return {
    fontSizeScale: clamp(partial?.fontSizeScale ?? DEFAULT_RECEIPT_LAYOUT.fontSizeScale, 0.65, 2.2),
    lineHeightScale: clamp(partial?.lineHeightScale ?? DEFAULT_RECEIPT_LAYOUT.lineHeightScale, 0.7, 2.0),
  };
}
