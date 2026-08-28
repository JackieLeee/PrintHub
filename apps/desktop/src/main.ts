import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray,
  type MenuItemConstructorOptions,
  type WebContents,
} from "electron";
import { VirtPrinterBridge } from "@virt-printer/bridge";
import { DEFAULT_HTTP_PORT, DEFAULT_TCP_PORT, MDNS_PRINTER_SERVICE_TYPE } from "@virt-printer/shared";
import { resolveTrayIconPath } from "./tray-icon.js";
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

let bridge: VirtPrinterBridge | null = null;
let unsubscribeBridge: (() => void) | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let settings: DesktopSettings = loadSettings();
let isQuitting = false;
const ipcSubscribers = new Set<WebContents>();

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
    dialog.showErrorBox(
      "缺少 Web UI",
      "未找到 apps/web/dist/index.html。请先运行：pnpm build:web:desktop",
    );
    app.quit();
    return;
  }

  const preloadPath = resolvePreloadPath();
  if (!existsSync(preloadPath)) {
    console.error("[desktop] preload missing:", preloadPath);
  } else {
    console.log("[desktop] preload", preloadPath);
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "PrintHub",
    show: false,
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

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
      "Bridge 启动失败",
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
  return new Promise((resolve) => {
    const promptWin = new BrowserWindow({
      width: 400,
      height: 240,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: "HTTP 端口",
      parent: mainWindow ?? undefined,
      modal: Boolean(mainWindow),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

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

    const html = `<!doctype html><html><body style="font:13px system-ui;margin:16px;color:#e8eaef;background:#171a22">
<p style="margin:0 0 8px;line-height:1.5">默认端口 <strong>${DEFAULT_HTTP_PORT}</strong>。TCP ${DEFAULT_TCP_PORT} 固定不可改。</p>
<p style="margin:0 0 12px;color:#9aa3b2;font-size:12px">修改后会重启局域网 HTTP/WebSocket 服务。</p>
<label>自定义 HTTP 端口（${MIN_HTTP_PORT}–${MAX_HTTP_PORT}）</label><br/>
<input id="p" type="number" min="${MIN_HTTP_PORT}" max="${MAX_HTTP_PORT}" value="${current}" style="width:100%;margin:12px 0;padding:6px;box-sizing:border-box"/>
<div style="text-align:right;display:flex;gap:8px;justify-content:flex-end">
<button id="c">取消</button>
<button id="o">确定</button>
</div>
<script>
const { ipcRenderer } = require('electron');
document.getElementById('c').onclick = () => ipcRenderer.invoke('${channelCancel}');
document.getElementById('o').onclick = () => ipcRenderer.invoke('${channelOk}', document.getElementById('p').value);
</script></body></html>`;

    promptWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    promptWin.on("closed", () => {
      cleanup();
      resolve(null);
    });
  });
}

async function changeHttpPort(): Promise<void> {
  if (!settings.lanHttpEnabled) {
    await dialog.showMessageBox({
      type: "info",
      title: "局域网 HTTP 未开启",
      message: "请先在菜单中开启「局域网 Web 访问」，再配置 HTTP 端口。",
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
    dialog.showErrorBox("重启失败", err instanceof Error ? err.message : String(err));
  }
}

function trafficLabel(state: "green" | "yellow" | "red", text: string): string {
  const dot = state === "green" ? "🟢" : state === "yellow" ? "🟡" : "🔴";
  return `${dot} ${text}`;
}

function buildTrayStatusItems(): MenuItemConstructorOptions[] {
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

  const lanDetail = !lanEnabled
    ? "已关闭（默认）"
    : lanUp
      ? `HTTP ${status?.httpPort} · ${hostIp}`
      : bridgeUp
        ? "HTTP 启动中…"
        : "Bridge 未运行";

  return [
    { label: "当前状态", enabled: false },
    {
      label: trafficLabel(bridgeUp ? "green" : "red", bridgeUp ? "Bridge · 运行中" : "Bridge · 未运行"),
      enabled: false,
    },
    {
      label: trafficLabel(tcpUp ? "green" : "red", `TCP ${DEFAULT_TCP_PORT} · ${tcpUp ? "监听中" : "未监听"}`),
      enabled: false,
    },
    {
      label: trafficLabel(
        status?.mdnsPrinter ? "green" : bridgeUp ? "yellow" : "red",
        status?.mdnsPrinter
          ? `mDNS · _${MDNS_PRINTER_SERVICE_TYPE}._tcp · ${DEFAULT_TCP_PORT}`
          : "mDNS · 未广播",
      ),
      enabled: false,
    },
    {
      label: trafficLabel(lanState, `局域网 HTTP · ${lanDetail}`),
      enabled: false,
    },
    { type: "separator" },
  ];
}

function buildTrayActionItems(): MenuItemConstructorOptions[] {
  const url = lanUrl();
  const httpPortLabel = settings.lanHttpEnabled
    ? `HTTP 端口…（当前 ${settings.httpPort}，默认 ${DEFAULT_HTTP_PORT}）`
    : `HTTP 端口…（默认 ${DEFAULT_HTTP_PORT}，需先开启局域网）`;

  return [
    {
      label: "打开控制台",
      accelerator: "CommandOrControl+O",
      click: () => showMainWindow(),
    },
    {
      label: "复制局域网地址",
      enabled: Boolean(url),
      click: () => {
        if (url) clipboard.writeText(url);
      },
    },
    { type: "separator" },
    {
      label: settings.lanHttpEnabled ? "关闭局域网 Web 访问" : "开启局域网 Web 访问",
      click: () => void toggleLanHttp(),
    },
    {
      label: httpPortLabel,
      click: () => void changeHttpPort(),
    },
    {
      label: settings.autoLaunch ? "关闭开机自启" : "开启开机自启",
      click: () => void toggleAutoLaunch(),
    },
    {
      label: "重启 Bridge",
      click: () => void restartBridge(),
    },
  ];
}

function buildServiceMenuItems(): MenuItemConstructorOptions[] {
  return [...buildTrayStatusItems(), ...buildTrayActionItems()];
}

function quitMenuItem(): MenuItemConstructorOptions {
  return {
    label: "退出 PrintHub",
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
  const template: MenuItemConstructorOptions[] = [];

  if (process.platform === "darwin") {
    template.push({
      label: "Edit",
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
      label: "Edit",
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
  const httpPart = settings.lanHttpEnabled ? ` · HTTP ${settings.httpPort}` : " · HTTP 关";
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
  const { response } = await dialog.showMessageBox({
    type: "info",
    buttons: ["打开系统设置", "知道了，不再提示"],
    defaultId: 0,
    cancelId: 1,
    title: "菜单栏图标需要授权",
    message: "PrintHub 托盘已创建，但 macOS 26 默认隐藏新菜单栏项。",
    detail:
      `请前往「系统设置 → 菜单栏」，将「${appName}」开关打开。\n\n` +
      "若列表中没有 PrintHub，请先通过 PrintHub.app 启动（pnpm dev:desktop 会自动打包并打开）。",
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

    // Pass file path only — do not call setImage()/resize(); both break macOS tray rendering.
    tray = new Tray(iconPath);
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
    dialog.showErrorBox(
      "缺少 Web UI",
      "未找到 apps/web/dist/index.html。请先运行：pnpm build:web:desktop",
    );
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
      "UI 启动失败",
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
    dialog.showErrorBox(
      "PrintHub 启动失败",
      settings.lanHttpEnabled
        ? `Bridge 无法在 HTTP ${settings.httpPort} 启动：${err instanceof Error ? err.message : String(err)}`
        : `Bridge 无法启动：${err instanceof Error ? err.message : String(err)}`,
    );
    app.quit();
    return;
  }

  createTray();
  createMainWindow();
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
