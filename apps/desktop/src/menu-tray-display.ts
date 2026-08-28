import type { NativeImage } from "electron";
import { menuIcons } from "./menu-icons.js";

export type StatusTone = "green" | "yellow" | "red";

/**
 * macOS / Windows tray menus do not reliably render MenuItem.icon (SVG especially).
 * Linux shows NativeImage icons; macOS + Windows use label prefixes below.
 */
export function useTrayMenuIcons(): boolean {
  return process.platform === "linux";
}

const TRAFFIC_MARK: Record<StatusTone, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

/** Action row prefixes — same glyphs as macOS menu bar. */
const ACTION_MARK = {
  openConsole: "▣ ",
  copyLanUrl: "⛓ ",
  lanWeb: "◐ ",
  httpPort: "# ",
  autoLaunch: "↗ ",
  restartBridge: "↻ ",
  language: "🌐 ",
} as const;

export function statusMenuLabel(tone: StatusTone, text: string): string {
  if (!useTrayMenuIcons()) return `${TRAFFIC_MARK[tone]} ${text}`;
  return text;
}

export function actionMenuLabel(
  kind: keyof typeof ACTION_MARK,
  text: string,
): string {
  if (!useTrayMenuIcons()) return `${ACTION_MARK[kind]}${text}`;
  return text;
}

export function trayMenuIcon(factory: () => NativeImage): NativeImage | undefined {
  if (!useTrayMenuIcons()) return undefined;
  const icon = factory();
  return icon.isEmpty() ? undefined : icon;
}

export { menuIcons };
