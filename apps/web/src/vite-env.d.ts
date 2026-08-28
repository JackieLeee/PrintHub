/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

import type { BridgeMessage, HubStatus, PrinterSimConfig, PrinterSimEvent } from "@virt-printer/shared";

interface DesktopSettingsView {
  lanHttpEnabled: boolean;
  httpPort: number;
  tcpPort: number;
}

interface PrintHubDesktopApi {
  isDesktop: true;
  getSettings: () => Promise<DesktopSettingsView>;
  getBridgeStatus: () => Promise<HubStatus | null>;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  onBridgeMessage: (callback: (message: BridgeMessage) => void) => () => void;
  printRaw: (dataBase64: string) => Promise<{
    ok: boolean;
    jobId: string;
    byteLength: number;
    protocol: string;
  }>;
  printImage: (args: {
    imageBase64: string;
    protocol?: "escpos" | "tspl";
    width?: number;
  }) => Promise<{ ok: boolean; jobId: string; byteLength: number }>;
  getSimConfig: () => Promise<PrinterSimConfig>;
  setSimConfig: (partial: Partial<PrinterSimConfig>) => Promise<PrinterSimConfig>;
  kickDrawer: (pin?: number) => Promise<{ ok: boolean; event: PrinterSimEvent | null }>;
  clearSimEvents: () => Promise<{ ok: boolean }>;
  getLanUrl: () => Promise<string | null>;
  setLanHttpEnabled: (enabled: boolean) => Promise<DesktopSettingsView>;
  setHttpPort: (port: number) => Promise<DesktopSettingsView>;
  restartBridge: () => Promise<DesktopSettingsView>;
  copyLanUrl: () => Promise<string | null>;
}

declare global {
  interface Window {
    printhubDesktop?: PrintHubDesktopApi;
  }
}

export {};
