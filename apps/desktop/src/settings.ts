import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_HTTP_PORT } from "@virt-printer/shared";

export type TrayIconVariant = "a" | "b" | "c" | "d";

export interface DesktopSettings {
  /** Optional LAN HTTP + WebSocket for browser/curl access on the network. */
  lanHttpEnabled: boolean;
  httpPort: number;
  autoLaunch: boolean;
  /** User dismissed macOS 26+ menu bar permission hint. */
  menuBarHintDismissed?: boolean;
  /** Menu bar icon variant (same geometry as web favicon, template colors). */
  trayIconVariant?: TrayIconVariant;
}

const DEFAULTS: DesktopSettings = {
  lanHttpEnabled: false,
  httpPort: DEFAULT_HTTP_PORT,
  autoLaunch: false,
  trayIconVariant: "a",
};

export function normalizeTrayIconVariant(value: unknown): TrayIconVariant {
  return value === "b" || value === "c" || value === "d" ? value : "a";
}

export const MIN_HTTP_PORT = 1024;
export const MAX_HTTP_PORT = 65535;

export function normalizeHttpPort(value: unknown): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < MIN_HTTP_PORT || port > MAX_HTTP_PORT) {
    return DEFAULT_HTTP_PORT;
  }
  return port;
}

function settingsPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

export function loadSettings(): DesktopSettings {
  try {
    const path = settingsPath();
    if (!existsSync(path)) return { ...DEFAULTS };
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<DesktopSettings> & {
      httpPort?: unknown;
    };
    return {
      lanHttpEnabled: Boolean(raw.lanHttpEnabled),
      httpPort: normalizeHttpPort(raw.httpPort),
      autoLaunch: Boolean(raw.autoLaunch),
      menuBarHintDismissed: Boolean(raw.menuBarHintDismissed),
      trayIconVariant: normalizeTrayIconVariant(raw.trayIconVariant),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: DesktopSettings): void {
  const dir = app.getPath("userData");
  mkdirSync(dir, { recursive: true });
  writeFileSync(settingsPath(), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}
