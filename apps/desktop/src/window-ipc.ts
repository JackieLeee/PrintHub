import { ipcMain, type BrowserWindow } from "electron";

export function registerWindowIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle("desktop:window-minimize", () => {
    getMainWindow()?.minimize();
  });

  ipcMain.handle("desktop:window-toggle-maximize", () => {
    const win = getMainWindow();
    if (!win) return false;
    if (win.isMaximized()) {
      win.unmaximize();
      return false;
    }
    win.maximize();
    return true;
  });

  ipcMain.handle("desktop:window-close", () => {
    getMainWindow()?.close();
  });
}
