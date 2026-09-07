import { Icon } from "./Icon.js";

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
      <Icon name="chevronDown" className="disclosure-toggle-icon" />
    </span>
  );
}
