import type { PrinterSimConfig, PrinterSimEvent } from "@virt-printer/shared";
import { isDesktopApp } from "./is-desktop";

export async function fetchSimConfig(httpBase: string): Promise<PrinterSimConfig> {
  if (isDesktopApp() && window.printhubDesktop) {
    return window.printhubDesktop.getSimConfig();
  }

  const res = await fetch(`${httpBase}/sim/config`);
  if (!res.ok) throw new Error(`sim config ${res.status}`);
  return (await res.json()) as PrinterSimConfig;
}

export async function updateSimConfig(
  httpBase: string,
  partial: Partial<PrinterSimConfig>,
): Promise<PrinterSimConfig> {
  if (isDesktopApp() && window.printhubDesktop) {
    return window.printhubDesktop.setSimConfig(partial);
  }

  const res = await fetch(`${httpBase}/sim/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(partial),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `sim config ${res.status}`);
  }
  return (await res.json()) as PrinterSimConfig;
}

export async function kickCashDrawer(httpBase: string, pin = 0): Promise<PrinterSimEvent | null> {
  if (isDesktopApp() && window.printhubDesktop) {
    const body = await window.printhubDesktop.kickDrawer(pin);
    return body.event ?? null;
  }

  const res = await fetch(`${httpBase}/sim/drawer/kick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) throw new Error(`drawer kick ${res.status}`);
  const body = (await res.json()) as { event?: PrinterSimEvent };
  return body.event ?? null;
}
