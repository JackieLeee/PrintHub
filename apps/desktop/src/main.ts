import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  shell,
  Tray,
  type MenuItemConstructorOptions,
  type WebContents,
} from "electron";
import { VirtPrinterBridge } from "@virt-printer/bridge";
import { DEFAULT_HTTP_PORT, DEFAULT_TCP_PORT, MDNS_PRINTER_SERVICE_TYPE } from "@virt-printer/shared";
import { loadTrayIconImage, resolveTrayIconPath } from "./tray-icon.js";
import { attachBridgeSubscription, registerBridgeIpc } from "./bridge-ipc.js";
import { existsSync } from "node:fs";
import {
  resolveAppIconPath,
  resolvePreloadPath,
  resolveWebRoot,
} from "./paths.js";
import { startUiServer, stopUiServer, uiWindowUrl } from "./ui-server.js";
import {
  loadSettings,
  MAX_HTTP_PORT,
  MIN_HTTP_PORT,
  normalizeHttpPort,
  saveSettings,
  type DesktopSettings,
} from "./settings.js";
import {
  desktopFormat,
  getDesktopTranslations,
  normalizeUiLocale,
  resolveSystemLocale,
  type DesktopLocale,
} from "./i18n/index.js";
import { buildPortPromptHtml } from "./port-prompt-html.js";
import { menuIcons, clearMenuIconCache } from "./menu-icons.js";
import {
  actionMenuLabel,
  statusMenuLabel,
  trayMenuIcon,
} from "./menu-tray-display.js";
import {
  applyCustomWindowChrome,
  buildMainWindowOptions,
} from "./window-options.js";
import { registerWindowIpc } from "./window-ipc.js";

let bridge: VirtPrinterBridge | null = null;
let unsubscribeBridge: (() => void) | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let settings: DesktopSettings = loadSettings();
let isQuitting = false;
const ipcSubscribers = new Set<WebContents>();

function desktopLocale(): DesktopLocale {
  return settings.uiLocale ?? resolveSystemLocale();
}

function dt() {
  return getDesktopTranslations(desktopLocale());
}

function df(template: string, vars: Record<string, string | number> = {}): string {
  return desktopFormat(template, vars);
}

function broadcastUiLocale(locale: DesktopLocale): void {
  const targets = new Set<WebContents>();
  if (mainWindow && !mainWindow.isDestroyed()) {
    targets.add(mainWindow.webContents);
  }
  for (const wc of ipcSubscribers) {
    if (!wc.isDestroyed()) targets.add(wc);
  }
  for (const wc of targets) {
    wc.send("desktop:ui-locale-changed", locale);
  }
}

function applyUiLocale(next: DesktopLocale, notifyRenderer = true): DesktopLocale {
  if (next !== settings.uiLocale) {
    settings = { ...settings, uiLocale: next };
    saveSettings(settings);
    updateTrayMenu();
  }
  if (notifyRenderer) broadcastUiLocale(next);
  return next;
}

function lanUrl(): string | null {
  if (!settings.lanHttpEnabled) return null;
  const status = bridge?.getPublicStatus();
  if (!status?.hostIp || status.httpPort <= 0) return null;
  return `http://${status.hostIp}:${status.httpPort}`;
}

async function startBridge(): Promise<void> {
  if (unsubscribeBridge) {
    unsubscribeBridge();
    unsubscribeBridge = null;
  }
  if (bridge) {
    await bridge.stop();
    bridge = null;
  }

  if (settings.lanHttpEnabled) {
    const webRoot = resolveWebRoot();
    if (webRoot) process.env.VPH_WEB_DIR = webRoot;
    else delete process.env.VPH_WEB_DIR;
  } else {
    delete process.env.VPH_WEB_DIR;
  }

  bridge = new VirtPrinterBridge({
    tcpPort: DEFAULT_TCP_PORT,
    httpPort: settings.httpPort,
    enableHttp: settings.lanHttpEnabled,
    serveStaticUi: settings.lanHttpEnabled,
  });
  await bridge.start();
  unsubscribeBridge = attachBridgeSubscription(bridge, ipcSubscribers);
  pushStatusToSubscribers();
}

function pushStatusToSubscribers(): void {
  if (!bridge) return;
  const message = { type: "hub.status" as const, status: bridge.getPublicStatus() };
  for (const wc of ipcSubscribers) {
    if (wc.isDestroyed()) {
      ipcSubscribers.delete(wc);
      continue;
    }
    wc.send("desktop:bridge-message", message);
  }
}

function showMainWindow(): void {
  if (!mainWindow) {
    createMainWindow();
    return;
  }
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function createMainWindow(): void {
  const iconPath = resolveAppIconPath();
  if (!resolveWebRoot()) {
    const d = dt().dialog;
    dialog.showErrorBox(d.missingWebUiTitle, d.missingWebUiMessage);
    app.quit();
    return;
  }

  const preloadPath = resolvePreloadPath();
  if (!existsSync(preloadPath)) {
    console.error("[desktop] preload missing:", preloadPath);
  } else {
    console.log("[desktop] preload", preloadPath);
  }

  mainWindow = new BrowserWindow(buildMainWindowOptions(preloadPath, iconPath ?? undefined));
  applyCustomWindowChrome(mainWindow);

  mainWindow.webContents.on("preload-error", (_event, path, err) => {
    console.error("[desktop] preload-error", path, err);
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  void mainWindow.loadURL(uiWindowUrl());

  const wc = mainWindow.webContents;
  wc.on("destroyed", () => {
    ipcSubscribers.delete(wc);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    pushStatusToSubscribers();
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, desc, url) => {
    console.error("[desktop] did-fail-load", code, desc, url);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
}

async function reloadUi(): Promise<void> {
  if (!mainWindow) {
    createMainWindow();
    return;
  }
  await mainWindow.loadURL(uiWindowUrl());
}

function applyAutoLaunch(): void {
  if (!settings.autoLaunch) {
    app.setLoginItemSettings({ openAtLogin: false });
    return;
  }
  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
    });
  } catch {
    /* macOS may deny login item without accessibility approval */
  }
}

async function persistSettingsAndRestart(next: DesktopSettings): Promise<boolean> {
  const previous = settings;
  settings = next;
  saveSettings(settings);

  try {
    await startBridge();
    pushStatusToSubscribers();
    updateTrayMenu();
    await reloadUi();
    pushStatusToSubscribers();
    updateTrayMenu();
    return true;
  } catch (err) {
    settings = previous;
    saveSettings(settings);
    updateTrayMenu();
    await dialog.showErrorBox(
      dt().dialog.bridgeStartFailedTitle,
      err instanceof Error ? err.message : String(err),
    );
    try {
      await startBridge();
      pushStatusToSubscribers();
      updateTrayMenu();
      await reloadUi();
      pushStatusToSubscribers();
      updateTrayMenu();
    } catch {
      app.quit();
    }
    return false;
  }
}

async function promptCustomPort(current: number): Promise<number | null> {
  const t = dt().portPrompt;
  return new Promise((resolve) => {
    const promptWin = new BrowserWindow({
      width: 420,
      height: 280,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: t.title,
      backgroundColor: "#171a22",
      parent: mainWindow ?? undefined,
      modal: Boolean(mainWindow),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });
    promptWin.setMenuBarVisibility(false);

    const channelOk = `desktop:port-ok:${Date.now()}`;
    const channelCancel = `desktop:port-cancel:${Date.now()}`;

    const cleanup = () => {
      ipcMain.removeHandler(channelOk);
      ipcMain.removeHandler(channelCancel);
    };

    ipcMain.handle(channelCancel, () => {
      cleanup();
      promptWin.close();
      resolve(null);
      return null;
    });

    ipcMain.handle(channelOk, (_event, raw: unknown) => {
      const port = Number(raw);
      cleanup();
      promptWin.close();
      if (!Number.isInteger(port) || port < MIN_HTTP_PORT || port > MAX_HTTP_PORT) {
        resolve(null);
        return null;
      }
      resolve(port);
      return port;
    });

    const html = buildPortPromptHtml({
      title: t.title,
      hintHtml: df(t.hint, { default: DEFAULT_HTTP_PORT, tcp: DEFAULT_TCP_PORT }),
      note: t.note,
      label: df(t.label, { min: MIN_HTTP_PORT, max: MAX_HTTP_PORT }),
      cancel: t.cancel,
      ok: t.ok,
      current,
      min: MIN_HTTP_PORT,
      max: MAX_HTTP_PORT,
      channelOk,
      channelCancel,
    });

    promptWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    promptWin.on("closed", () => {
      cleanup();
      resolve(null);
    });
  });
}

async function changeHttpPort(): Promise<void> {
  if (!settings.lanHttpEnabled) {
    const d = dt().dialog;
    await dialog.showMessageBox({
      type: "info",
      title: d.lanHttpOffTitle,
      message: d.lanHttpOffMessage,
    });
    return;
  }

  const nextPort = await promptCustomPort(settings.httpPort);
  if (nextPort === null) return;
  await persistSettingsAndRestart({
    ...settings,
    httpPort: normalizeHttpPort(nextPort),
  });
}

async function toggleLanHttp(): Promise<void> {
  await persistSettingsAndRestart({
    ...settings,
    lanHttpEnabled: !settings.lanHttpEnabled,
  });
}

async function toggleAutoLaunch(): Promise<void> {
  settings = { ...settings, autoLaunch: !settings.autoLaunch };
  saveSettings(settings);
  applyAutoLaunch();
  updateTrayMenu();
}

async function restartBridge(): Promise<void> {
  try {
    await startBridge();
    pushStatusToSubscribers();
    updateTrayMenu();
    await reloadUi();
    pushStatusToSubscribers();
    updateTrayMenu();
  } catch (err) {
    dialog.showErrorBox(dt().dialog.restartFailedTitle, err instanceof Error ? err.message : String(err));
  }
}

function buildTrayStatusItems(): MenuItemConstructorOptions[] {
  const t = dt().menu;
  const status = bridge?.getPublicStatus();
  const bridgeUp = Boolean(status?.listening);
  const tcpUp = bridgeUp;
  const lanEnabled = settings.lanHttpEnabled;
  const lanUp = lanEnabled && bridgeUp && (status?.httpPort ?? 0) > 0;
  const hostIp = status?.hostIp ?? "—";

  const lanState: "green" | "yellow" | "red" = !lanEnabled
    ? "red"
    : lanUp
      ? "green"
      : bridgeUp
        ? "yellow"
        : "red";

  const mdnsState: "green" | "yellow" | "red" = status?.mdnsPrinter
    ? "green"
    : bridgeUp
      ? "yellow"
      : "red";

  const lanDetail = !lanEnabled
    ? t.lanDisabled
    : lanUp
      ? `HTTP ${status?.httpPort} · ${hostIp}`
      : bridgeUp
        ? t.lanStarting
        : t.bridgeNotRunning;

  return [
    {
      label: t.currentStatus,
      icon: trayMenuIcon(() => menuIcons.statusHeader()),
      enabled: false,
    },
    {
      label: statusMenuLabel(bridgeUp ? "green" : "red", bridgeUp ? t.bridgeRunning : t.bridgeStopped),
      icon: trayMenuIcon(() => menuIcons.statusRow("bridge", bridgeUp ? "green" : "red")),
      enabled: false,
    },
    {
      label: statusMenuLabel(
        tcpUp ? "green" : "red",
        `TCP ${DEFAULT_TCP_PORT} · ${tcpUp ? t.tcpListening : t.tcpNotListening}`,
      ),
      icon: trayMenuIcon(() => menuIcons.statusRow("tcp", tcpUp ? "green" : "red")),
      enabled: false,
    },
    {
      label: statusMenuLabel(
        mdnsState,
        status?.mdnsPrinter
          ? df(t.mdnsOn, { type: MDNS_PRINTER_SERVICE_TYPE, port: DEFAULT_TCP_PORT })
          : t.mdnsOff,
      ),
      icon: trayMenuIcon(() => menuIcons.statusRow("mdns", mdnsState)),
      enabled: false,
    },
    {
      label: statusMenuLabel(lanState, `${t.lanHttp} · ${lanDetail}`),
      icon: trayMenuIcon(() => menuIcons.statusRow("lan", lanState)),
      enabled: false,
    },
    { type: "separator" },
  ];
}

function buildLanguageMenuItems(): MenuItemConstructorOptions[] {
  const t = dt().menu;
  const current = desktopLocale();
  return [
    { type: "separator" },
    {
      label: actionMenuLabel("language", t.language),
      icon: trayMenuIcon(() => menuIcons.language()),
      submenu: [
        {
          label: t.languageEn,
          type: "radio",
          checked: current === "en",
          click: () => applyUiLocale("en"),
        },
        {
          label: t.languageZh,
          type: "radio",
          checked: current === "zh",
          click: () => applyUiLocale("zh"),
        },
      ],
    },
  ];
}

function buildTrayActionItems(): MenuItemConstructorOptions[] {
  const t = dt().menu;
  const url = lanUrl();
  const httpPortLabel = settings.lanHttpEnabled
    ? df(t.httpPortWithCurrent, { current: settings.httpPort, default: DEFAULT_HTTP_PORT })
    : df(t.httpPortLanOff, { default: DEFAULT_HTTP_PORT });

  return [
    {
      label: actionMenuLabel("openConsole", t.openConsole),
      icon: trayMenuIcon(() => menuIcons.openConsole()),
      accelerator: "CommandOrControl+O",
      click: () => showMainWindow(),
    },
    {
      label: actionMenuLabel("copyLanUrl", t.copyLanUrl),
      icon: trayMenuIcon(() => menuIcons.copyLink()),
      enabled: Boolean(url),
      click: () => {
        if (url) clipboard.writeText(url);
      },
    },
    { type: "separator" },
    {
      label: actionMenuLabel(
        "lanWeb",
        settings.lanHttpEnabled ? t.disableLanWeb : t.enableLanWeb,
      ),
      icon: trayMenuIcon(() => menuIcons.lanToggle(settings.lanHttpEnabled)),
      click: () => void toggleLanHttp(),
    },
    {
      label: actionMenuLabel("httpPort", httpPortLabel),
      icon: trayMenuIcon(() => menuIcons.httpPort()),
      click: () => void changeHttpPort(),
    },
    {
      label: actionMenuLabel(
        "autoLaunch",
        settings.autoLaunch ? t.disableAutoLaunch : t.enableAutoLaunch,
      ),
      icon: trayMenuIcon(() => menuIcons.autoLaunch(settings.autoLaunch)),
      click: () => void toggleAutoLaunch(),
    },
    {
      label: actionMenuLabel("restartBridge", t.restartBridge),
      icon: trayMenuIcon(() => menuIcons.restart()),
      click: () => void restartBridge(),
    },
    ...buildLanguageMenuItems(),
  ];
}

function buildServiceMenuItems(): MenuItemConstructorOptions[] {
  return [...buildTrayStatusItems(), ...buildTrayActionItems()];
}

function quitMenuItem(): MenuItemConstructorOptions {
  return {
    label: dt().menu.quit,
    icon: trayMenuIcon(() => menuIcons.quit()),
    accelerator: "CommandOrControl+Q",
    click: () => {
      isQuitting = true;
      app.quit();
    },
  };
}

function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([...buildServiceMenuItems(), { type: "separator" }, quitMenuItem()]);
}

function installApplicationMenu(): void {
  const t = dt().menu;
  const template: MenuItemConstructorOptions[] = [];

  if (process.platform === "darwin") {
    template.push({
      label: t.edit,
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
      ],
    });
    template.push({
      label: "PrintHub",
      submenu: [
        { role: "about" },
        { type: "separator" },
        ...buildServiceMenuItems(),
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        quitMenuItem(),
      ],
    });
  } else {
    template.push({
      label: t.edit,
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "delete" },
        { role: "selectAll" },
      ],
    });
    template.push({
      label: "PrintHub",
      submenu: [...buildServiceMenuItems(), { type: "separator" }, quitMenuItem()],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function updateTrayMenu(): void {
  installApplicationMenu();
  tray?.setContextMenu(buildTrayMenu());
  const t = dt().menu;
  const httpPart = settings.lanHttpEnabled ? ` · HTTP ${settings.httpPort}` : t.trayHttpOff;
  tray?.setToolTip(`PrintHub · TCP ${DEFAULT_TCP_PORT}${httpPart}`);
}

function isMacOs26OrLater(): boolean {
  if (process.platform !== "darwin") return false;
  const major = Number(process.getSystemVersion().split(".")[0]);
  return Number.isFinite(major) && major >= 26;
}

function menuBarPermissionAppName(): string {
  return "PrintHub";
}

async function maybePromptMenuBarPermission(): Promise<void> {
  if (!isMacOs26OrLater() || settings.menuBarHintDismissed) return;

  const appName = menuBarPermissionAppName();
  const d = dt().dialog;
  const { response } = await dialog.showMessageBox({
    type: "info",
    buttons: [d.openSystemSettings, d.dismissHint],
    defaultId: 0,
    cancelId: 1,
    title: d.menuBarPermTitle,
    message: d.menuBarPermMessage,
    detail: df(d.menuBarPermDetail, { appName }),
  });

  if (response === 0) {
    void shell.openExternal("x-apple.systempreferences:com.apple.control-center?MenuBar");
  } else {
    settings = { ...settings, menuBarHintDismissed: true };
    saveSettings(settings);
  }
}

function createTray(): void {
  try {
    const iconPath = resolveTrayIconPath(settings.trayIconVariant ?? "a");
    if (!iconPath) {
      console.warn("[desktop] tray icon file not found, skipping menu bar icon");
      return;
    }

    const preview = nativeImage.createFromPath(iconPath);
    const size = preview.getSize();
    console.log(
      "[desktop] tray icon",
      iconPath,
      `${size.width}x${size.height}`,
      "empty=",
      preview.isEmpty(),
      "template=",
      preview.isTemplateImage(),
    );

    if (preview.isEmpty()) {
      console.warn("[desktop] tray icon is empty, skipping menu bar icon");
      return;
    }

    // macOS: pass file path only — setImage()/resize() break menu bar rendering.
    // Windows/Linux: recolor template PNG to light for dark taskbar.
    if (process.platform === "darwin") {
      tray = new Tray(iconPath);
    } else {
      const lightIcon = loadTrayIconImage(settings.trayIconVariant ?? "a");
      if (!lightIcon || lightIcon.isEmpty()) {
        console.warn("[desktop] tray icon recolor failed, skipping tray");
        return;
      }
      tray = new Tray(lightIcon);
    }
    tray.setToolTip("PrintHub");
    updateTrayMenu();
    tray.on("double-click", () => showMainWindow());
    tray.on("right-click", () => updateTrayMenu());
    console.log("[desktop] menu bar tray ready");
    if (isMacOs26OrLater()) {
      console.log(
        `[desktop] macOS 26+: enable "${menuBarPermissionAppName()}" in System Settings → Menu Bar if icon is hidden`,
      );
    }
    void maybePromptMenuBarPermission();
  } catch (err) {
    console.warn("[desktop] tray init failed:", err);
  }
}

function desktopSettingsView() {
  return {
    lanHttpEnabled: settings.lanHttpEnabled,
    httpPort: settings.httpPort,
    tcpPort: DEFAULT_TCP_PORT,
  };
}

function registerDesktopIpc(): void {
  registerBridgeIpc({
    getBridge: () => bridge,
    getSubscribers: () => ipcSubscribers,
  });
  registerWindowIpc(() => mainWindow);

  ipcMain.handle("desktop:get-settings", () => desktopSettingsView());
  ipcMain.handle("desktop:get-lan-url", () => lanUrl());
  ipcMain.handle("desktop:set-lan-http-enabled", async (_event, enabled: unknown) => {
    const next = Boolean(enabled);
    if (next === settings.lanHttpEnabled) return desktopSettingsView();
    await persistSettingsAndRestart({ ...settings, lanHttpEnabled: next });
    return desktopSettingsView();
  });
  ipcMain.handle("desktop:set-http-port", async (_event, port: unknown) => {
    const next = normalizeHttpPort(port);
    if (next === settings.httpPort && settings.lanHttpEnabled) return desktopSettingsView();
    await persistSettingsAndRestart({
      ...settings,
      httpPort: next,
      lanHttpEnabled: true,
    });
    return desktopSettingsView();
  });
  ipcMain.handle("desktop:restart-bridge", async () => {
    await restartBridge();
    return desktopSettingsView();
  });
  ipcMain.handle("desktop:copy-lan-url", () => {
    const url = lanUrl();
    if (url) clipboard.writeText(url);
    return url;
  });
  ipcMain.handle("desktop:get-ui-locale", () => desktopLocale());
  ipcMain.handle("desktop:set-ui-locale", (_event, locale: unknown) => {
    const next = normalizeUiLocale(locale);
    if (!next) return desktopLocale();
    return applyUiLocale(next, false);
  });
}

function applyAppIcon(): void {
  const iconPath = resolveAppIconPath();
  if (!iconPath) {
    console.warn("[desktop] app icon not found");
    return;
  }
  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    console.warn("[desktop] app icon empty:", iconPath);
    return;
  }
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(image);
  }
}

async function bootstrap(): Promise<void> {
  app.setName("PrintHub");
  applyAppIcon();
  settings = loadSettings();

  const webRoot = resolveWebRoot();
  if (!webRoot) {
    const d = dt().dialog;
    dialog.showErrorBox(d.missingWebUiTitle, d.missingWebUiMessage);
    app.quit();
    return;
  }

  try {
    const uiPort = await startUiServer(webRoot, settings.uiServerPort ?? 0);
    if (uiPort !== settings.uiServerPort) {
      settings = { ...settings, uiServerPort: uiPort };
      saveSettings(settings);
    }
  } catch (err) {
    dialog.showErrorBox(
      dt().dialog.uiStartFailedTitle,
      err instanceof Error ? err.message : String(err),
    );
    app.quit();
    return;
  }

  installApplicationMenu();
  registerDesktopIpc();
  applyAutoLaunch();

  try {
    await startBridge();
  } catch (err) {
    const d = dt().dialog;
    const message = err instanceof Error ? err.message : String(err);
    dialog.showErrorBox(
      d.appStartFailedTitle,
      settings.lanHttpEnabled
        ? df(d.bridgeHttpFailed, { port: settings.httpPort, error: message })
        : df(d.bridgeFailed, { error: message }),
    );
    app.quit();
    return;
  }

  createTray();
  createMainWindow();

  nativeTheme.on("updated", () => {
    clearMenuIconCache();
    updateTrayMenu();
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showMainWindow());

  app.whenReady().then(() => {
    void bootstrap();
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("window-all-closed", () => {
    /* keep running in tray */
  });

  app.on("will-quit", () => {
    unsubscribeBridge?.();
    void bridge?.stop();
    void stopUiServer();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      showMainWindow();
    }
  });
}
