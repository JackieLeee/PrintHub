import type { IconComponent } from "reicon-react";
import {
  ChevronDown,
  FlipH,
  FlipV,
  Globe,
  Palette,
  Refresh,
  RotateLeft,
  RotateRight,
} from "reicon-react";

export const ICON_NAMES = [
  "globe",
  "palette",
  "chevronDown",
  "rotateLeft",
  "rotateRight",
  "flipHorizontal",
  "flipVertical",
  "refresh",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const MAP: Record<IconName, IconComponent> = {
  globe: Globe,
  palette: Palette,
  chevronDown: ChevronDown,
  rotateLeft: RotateLeft,
  rotateRight: RotateRight,
  flipHorizontal: FlipH,
  flipVertical: FlipV,
  refresh: Refresh,
};

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size, className }: IconProps) {
  const Component = MAP[name];
  return (
    <Component
      {...(size != null ? { size } : {})}
      weight="Outline"
      color="currentColor"
      className={className}
      aria-hidden="true"
    />
  );
}
