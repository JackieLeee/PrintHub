import { contextBridge, ipcRenderer } from "electron";
import type { BridgeMessage, PrinterSimConfig, PrinterSimEvent } from "@virt-printer/shared";

export interface DesktopSettingsView {
  lanHttpEnabled: boolean;
  httpPort: number;
  tcpPort: number;
}

contextBridge.exposeInMainWorld("printhubDesktop", {
  isDesktop: true as const,
  getSettings: () => ipcRenderer.invoke("desktop:get-settings") as Promise<DesktopSettingsView>,
  getBridgeStatus: () => ipcRenderer.invoke("desktop:get-bridge-status"),
  connect: () => ipcRenderer.invoke("desktop:connect") as Promise<boolean>,
  disconnect: () => ipcRenderer.invoke("desktop:disconnect") as Promise<boolean>,
  onBridgeMessage: (callback: (message: BridgeMessage) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, message: BridgeMessage) => {
      callback(message);
    };
    ipcRenderer.on("desktop:bridge-message", handler);
    return () => {
      ipcRenderer.removeListener("desktop:bridge-message", handler);
    };
  },
  printRaw: (dataBase64: string) =>
    ipcRenderer.invoke("desktop:print-raw", dataBase64) as Promise<{
      ok: boolean;
      jobId: string;
      byteLength: number;
      protocol: string;
    }>,
  printImage: (args: { imageBase64: string; protocol?: "escpos" | "tspl"; width?: number }) =>
    ipcRenderer.invoke("desktop:print-image", args) as Promise<{
      ok: boolean;
      jobId: string;
      byteLength: number;
    }>,
  getSimConfig: () => ipcRenderer.invoke("desktop:get-sim-config") as Promise<PrinterSimConfig>,
  setSimConfig: (partial: Partial<PrinterSimConfig>) =>
    ipcRenderer.invoke("desktop:set-sim-config", partial) as Promise<PrinterSimConfig>,
  kickDrawer: (pin?: number) =>
    ipcRenderer.invoke("desktop:kick-drawer", pin ?? 0) as Promise<{
      ok: boolean;
      event: PrinterSimEvent | null;
    }>,
  getLanUrl: () => ipcRenderer.invoke("desktop:get-lan-url") as Promise<string | null>,
  setLanHttpEnabled: (enabled: boolean) =>
    ipcRenderer.invoke("desktop:set-lan-http-enabled", enabled) as Promise<DesktopSettingsView>,
  setHttpPort: (port: number) =>
    ipcRenderer.invoke("desktop:set-http-port", port) as Promise<DesktopSettingsView>,
  restartBridge: () => ipcRenderer.invoke("desktop:restart-bridge") as Promise<DesktopSettingsView>,
  copyLanUrl: () => ipcRenderer.invoke("desktop:copy-lan-url") as Promise<string | null>,
});
