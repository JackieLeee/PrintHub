import type { ReactNode } from "react";

interface IconProps {
  className?: string;
}

function IconBase({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const s = {
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Counter-clockwise rotate */
export function RotateLeftIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path {...s} d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path {...s} d="M3 3v5h5" />
    </IconBase>
  );
}

/** Clockwise rotate */
export function RotateRightIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path {...s} d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path {...s} d="M21 3v5h-5" />
    </IconBase>
  );
}

/** Horizontal mirror */
export function MirrorHorizontalIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path {...s} d="m3 7 5 5-5 5" />
      <path {...s} d="m21 7-5 5 5 5" />
      <path {...s} d="M12 20V4" />
    </IconBase>
  );
}

/** Vertical mirror */
export function MirrorVerticalIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path {...s} d="m7 3 5 5 5-5" />
      <path {...s} d="m7 21 5-5 5 5" />
      <path {...s} d="M20 12H4" />
    </IconBase>
  );
}

/** Reset view */
export function ResetViewIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path {...s} d="M21 12a9 9 0 1 1-3-6.7" />
      <path {...s} d="M21 3v6h-6" />
    </IconBase>
  );
}
