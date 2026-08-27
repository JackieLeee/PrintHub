import {
  DEFAULT_RECEIPT_FONT_ID,
  type ReceiptFontId,
} from "@virt-printer/renderer";

const STORAGE_KEY = "virt-printer.receipt-font-id";

export function loadReceiptFontId(): ReceiptFontId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === DEFAULT_RECEIPT_FONT_ID) return DEFAULT_RECEIPT_FONT_ID;
  } catch {
    /* ignore */
  }
  return DEFAULT_RECEIPT_FONT_ID;
}

export function saveReceiptFontId(id: ReceiptFontId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
