export type ToastTone = "ok" | "err" | "info";

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

type Listener = (items: ToastItem[]) => void;

let seq = 0;
let items: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) {
    listener(items);
  }
}

export function showToast(message: string, tone: ToastTone = "ok", durationMs = 2600): void {
  const id = ++seq;
  items = [...items, { id, message, tone }];
  emit();
  window.setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, durationMs);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(items);
  return () => listeners.delete(listener);
}
