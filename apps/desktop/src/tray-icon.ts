import { app } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TrayIconVariant } from "./settings.js";

function assetCandidates(name: string): string[] {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const paths: string[] = [];

  if (app.isPackaged) {
    paths.push(join(process.resourcesPath, "app.asar.unpacked", "assets", "icons", name));
    paths.push(join(process.resourcesPath, "app.asar.unpacked", "assets", name));
    paths.push(join(process.resourcesPath, "assets", "icons", name));
    paths.push(join(process.resourcesPath, "assets", name));
  }

  paths.push(
    join(here, "../assets/icons", name),
    join(here, "../../assets/icons", name),
    join(here, "../assets", name),
    join(here, "../../assets", name),
  );
  return paths;
}

function resolveAsset(name: string): string | null {
  for (const path of assetCandidates(name)) {
    if (existsSync(path)) return path;
  }
  return null;
}

/** macOS menu bar template icon — same geometry as apps/web/public/favicon.svg. */
export function resolveTrayIconPath(variant: TrayIconVariant = "a"): string | null {
  const file = `tray-${variant}Template.png`;
  return resolveAsset(file) ?? resolveAsset("tray-aTemplate.png");
}

export const TRAY_ICON_VARIANTS: TrayIconVariant[] = ["a", "b", "c", "d"];

export const TRAY_ICON_LABELS: Record<TrayIconVariant, string> = {
  a: "标准 · 与 Tab 图标同形（无底板）",
  b: "圆角底板 · 同 favicon 外框",
  c: "粗体简化 · 无纸面细节线",
  d: "紧凑 · 更小边距",
};
