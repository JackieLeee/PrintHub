import { useEffect, useState } from "react";
import { subscribeToasts, type ToastItem } from "../lib/toast";

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`} role="status">
          {toast.message}
        </div>
      ))}
    </div>
  );
}
