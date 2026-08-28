import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  ariaLabel: string;
  options: Option[];
  onChange: (value: string) => void;
  /** Align popover to trigger start (default) or end edge — use end for right-side toolbar items. */
  align?: "start" | "end";
}

function usePopoverStyle(
  open: boolean,
  triggerRef: RefObject<HTMLButtonElement | null>,
  align: "start" | "end",
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const update = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const minWidth = Math.max(rect.width, 140);
      const next: CSSProperties = {
        position: "fixed",
        top: rect.bottom + 4,
        minWidth,
        zIndex: 10000,
        visibility: "visible",
      };
      if (align === "end") {
        next.left = Math.max(8, rect.right - minWidth);
      } else {
        next.left = rect.left;
      }
      setStyle(next);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, align, triggerRef]);

  return style;
}

/** Toolbar menu — popover renders in a portal to avoid header clipping. */
export function HeaderMenuSelect({
  value,
  ariaLabel,
  options,
  onChange,
  align = "start",
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverStyle = usePopoverStyle(open, triggerRef, align);
  const current = options.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".header-menu-select-popover")) return;
      setOpen(false);
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

  const popover =
    open &&
    createPortal(
      <ul
        className="header-menu-select-popover header-menu-select-popover--portal"
        role="listbox"
        aria-label={ariaLabel}
        style={popoverStyle}
      >
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
      </ul>,
      document.body,
    );

  return (
    <div className="header-menu-select" ref={wrapRef}>
      <button
        ref={triggerRef}
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
      {popover}
    </div>
  );
}
