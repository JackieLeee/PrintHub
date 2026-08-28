import { useEffect, useRef, useState } from "react";

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  ariaLabel: string;
  options: Option[];
  onChange: (value: string) => void;
}

/** Toolbar menu — popover always opens downward from the trigger. */
export function HeaderMenuSelect({ value, ariaLabel, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="header-menu-select" ref={wrapRef}>
      <button
        type="button"
        className="header-menu-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="header-menu-select-label">{current}</span>
        <span className="header-menu-select-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <ul className="header-menu-select-popover" role="listbox" aria-label={ariaLabel}>
          {options.map((o) => (
            <li key={o.value} role="none">
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`header-menu-select-option${o.value === value ? " active" : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
