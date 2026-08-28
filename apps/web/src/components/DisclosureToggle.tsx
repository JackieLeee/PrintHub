interface Props {
  open: boolean;
  className?: string;
}

/** Borderless chevron; rotates 180° when open (workbench header, cmd-ref trigger). */
export function DisclosureToggle({ open, className = "" }: Props) {
  return (
    <span
      className={`disclosure-toggle${open ? " disclosure-toggle--open" : ""}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <svg
        className="disclosure-toggle-icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </span>
  );
}
