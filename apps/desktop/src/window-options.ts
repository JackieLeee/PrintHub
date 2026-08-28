import type { BrowserWindow, BrowserWindowConstructorOptions, WebPreferences } from "electron";

/** Matches apps/web `--bg` default. */
export const DESKTOP_CHROME_BG = "#0f1117";
export const CUSTOM_TITLE_BAR_HEIGHT = 40;

const baseWebPreferences: WebPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
};

/** Non-macOS platforms use frameless window + in-app traffic-light controls. */
export function usesCustomTrafficLights(): boolean {
  return process.platform !== "darwin";
}

export function buildMainWindowOptions(
  preloadPath: string,
  iconPath?: string,
): BrowserWindowConstructorOptions {
  const options: BrowserWindowConstructorOptions = {
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "PrintHub",
    show: false,
    backgroundColor: DESKTOP_CHROME_BG,
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      ...baseWebPreferences,
      preload: preloadPath,
    },
  };

  if (usesCustomTrafficLights()) {
    return {
      ...options,
      frame: false,
      autoHideMenuBar: true,
    };
  }

  return options;
}

export function applyCustomWindowChrome(win: BrowserWindow): void {
  if (!usesCustomTrafficLights()) return;
  win.setMenuBarVisibility(false);
  win.setAutoHideMenuBar(true);
}
