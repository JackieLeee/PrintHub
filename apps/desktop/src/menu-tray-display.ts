import type { NativeImage } from "electron";
import { menuIcons } from "./menu-icons.js";

export type StatusTone = "green" | "yellow" | "red";

/**
 * macOS tray / context menus often ignore MenuItem.icon (SVG + color especially).
 * Use label prefixes on darwin; keep NativeImage icons on Windows/Linux.
 */
export function useTrayMenuIcons(): boolean {
  return process.platform !== "darwin";
}

const TRAFFIC_MARK: Record<StatusTone, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

/** Action row prefixes — Unicode symbols, not emoji (except Language globe). */
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
  return factory();
}

export { menuIcons };
