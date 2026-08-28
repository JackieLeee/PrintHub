import { useEffect, useRef } from "react";
import { useLocale } from "../i18n/context";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="confirm-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="confirm-dialog-title">
          {title}
        </h3>
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn-sm btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button ref={confirmRef} type="button" className="btn-sm confirm-dialog-confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shorthand for sample overwrite confirmation. */
export function SampleOverwriteDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  return (
    <ConfirmDialog
      open={open}
      title={t.rawPrint.overwriteSampleTitle}
      message={t.rawPrint.overwriteSampleBody}
      confirmLabel={t.rawPrint.overwriteConfirm}
      cancelLabel={t.rawPrint.cancel}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

/** Shorthand for format-tab switch when editor has non-sample content. */
export function TabSwitchConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  return (
    <ConfirmDialog
      open={open}
      title={t.rawPrint.tabSwitchTitle}
      message={t.rawPrint.tabSwitchBody}
      confirmLabel={t.rawPrint.tabSwitchConfirm}
      cancelLabel={t.rawPrint.cancel}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
