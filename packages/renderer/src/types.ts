export interface RenderOptions {
  widthPx?: number;
  paddingPx?: number;
  background?: string;
  foreground?: string;
  /** Receipt text-mode font preset id (see `receipt-fonts.ts`). */
  receiptFontId?: string;
  /** Font size / line height / column width tuning for text preview. */
  receiptLayout?: Partial<import("./receipt-layout.js").ReceiptLayoutTuning>;
}
