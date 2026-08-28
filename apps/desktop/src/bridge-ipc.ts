import type { WebContents } from "electron";
import { ipcMain } from "electron";
import type { VirtPrinterBridge } from "@virt-printer/bridge";
import type { BridgeMessage, PrinterSimConfig } from "@virt-printer/shared";

const BRIDGE_MESSAGE_CHANNEL = "desktop:bridge-message";

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64.replace(/\s/g, ""), "base64");
}

export interface BridgeIpcContext {
  getBridge: () => VirtPrinterBridge | null;
  getSubscribers: () => Set<WebContents>;
}

export function attachBridgeSubscription(
  bridge: VirtPrinterBridge,
  subscribers: Set<WebContents>,
): () => void {
  return bridge.subscribe((message: BridgeMessage) => {
    const payload = JSON.parse(JSON.stringify(message)) as BridgeMessage;
    for (const wc of subscribers) {
      if (wc.isDestroyed()) {
        subscribers.delete(wc);
        continue;
      }
      wc.send(BRIDGE_MESSAGE_CHANNEL, payload);
    }
  });
}

const LOCAL_UI_IP = "127.0.0.1";

export function registerBridgeIpc(ctx: BridgeIpcContext): void {
  ipcMain.handle("desktop:get-bridge-status", () => {
    const bridge = ctx.getBridge();
    return bridge?.getPublicStatus() ?? null;
  });

  ipcMain.handle("desktop:connect", (event) => {
    const wc = event.sender;
    ctx.getSubscribers().add(wc);
    const bridge = ctx.getBridge();
    if (bridge) {
      wc.send(BRIDGE_MESSAGE_CHANNEL, {
        type: "hub.status",
        status: bridge.getPublicStatus(),
      } satisfies BridgeMessage);
    }
    return Boolean(bridge);
  });

  ipcMain.handle("desktop:disconnect", (event) => {
    ctx.getSubscribers().delete(event.sender);
    return true;
  });

  ipcMain.handle("desktop:print-raw", async (_event, raw: unknown) => {
    const bridge = ctx.getBridge();
    if (!bridge) throw new Error("bridge not running");
    const data =
      typeof raw === "string"
        ? base64ToBuffer(raw)
        : Buffer.from(raw as ArrayBuffer);
    if (data.length === 0) throw new Error("empty payload");
    const job = bridge.ingestRaw(data, "desktop");
    return { ok: true, jobId: job.id, byteLength: job.byteLength, protocol: job.protocol };
  });

  ipcMain.handle(
    "desktop:print-image",
    async (
      _event,
      args: { imageBase64?: string; protocol?: "escpos" | "tspl"; width?: number },
    ) => {
      const bridge = ctx.getBridge();
      if (!bridge) throw new Error("bridge not running");
      if (!args?.imageBase64) throw new Error("missing imageBase64");
      const imageBuf = base64ToBuffer(args.imageBase64);
      if (imageBuf.length === 0) throw new Error("empty image");
      const job = await bridge.ingestImage(imageBuf, {
        protocol: args.protocol ?? "escpos",
        maxWidth: args.width ?? 384,
        sourceIp: "desktop",
      });
      return { ok: true, jobId: job.id, byteLength: job.byteLength };
    },
  );

  ipcMain.handle("desktop:get-sim-config", () => {
    const bridge = ctx.getBridge();
    if (!bridge) throw new Error("bridge not running");
    return bridge.getPrinterSimConfig();
  });

  ipcMain.handle("desktop:set-sim-config", (_event, partial: Partial<PrinterSimConfig>) => {
    const bridge = ctx.getBridge();
    if (!bridge) throw new Error("bridge not running");
    return bridge.setPrinterSimConfig(partial, LOCAL_UI_IP);
  });

  ipcMain.handle("desktop:kick-drawer", (_event, pin = 0) => {
    const bridge = ctx.getBridge();
    if (!bridge) throw new Error("bridge not running");
    const event = bridge.kickCashDrawer(Number(pin) || 0, LOCAL_UI_IP);
    return { ok: true, event };
  });
}

export function encodePayloadForIpc(payload: Uint8Array): string {
  return bytesToBase64(payload);
}
