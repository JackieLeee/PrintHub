import { app } from "electron";
import { en } from "./locales/en.js";
import { zh } from "./locales/zh.js";
import type { DesktopLocale, DesktopTranslations } from "./types.js";

const catalogs: Record<DesktopLocale, DesktopTranslations> = { en, zh };

export type { DesktopLocale, DesktopTranslations };

export function normalizeUiLocale(value: unknown): DesktopLocale | undefined {
  return value === "en" || value === "zh" ? value : undefined;
}

export function resolveSystemLocale(): DesktopLocale {
  const lang = app.getLocale();
  if (lang.toLowerCase().startsWith("zh")) return "zh";
  return "en";
}

export function getDesktopTranslations(locale: DesktopLocale): DesktopTranslations {
  return catalogs[locale];
}

export function desktopFormat(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}
