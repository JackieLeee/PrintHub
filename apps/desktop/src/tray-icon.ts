import { app, nativeImage, type NativeImage } from "electron";
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

/** Light tray icon for Windows/Linux taskbar (template PNGs are black-on-transparent). */
export function loadTrayIconImage(variant: TrayIconVariant = "a"): NativeImage | null {
  const iconPath = resolveTrayIconPath(variant);
  if (!iconPath) return null;

  const source = nativeImage.createFromPath(iconPath);
  if (source.isEmpty()) return null;

  if (process.platform === "darwin") return source;

  const { width, height } = source.getSize();
  const bitmap = source.toBitmap();
  const light = Buffer.alloc(bitmap.length);
  for (let i = 0; i < bitmap.length; i += 4) {
    const alpha = bitmap[i + 3];
    light[i] = 232;
    light[i + 1] = 234;
    light[i + 2] = 239;
    light[i + 3] = alpha;
  }
  return nativeImage.createFromBuffer(light, { width, height });
}

export const TRAY_ICON_VARIANTS: TrayIconVariant[] = ["a", "b", "c", "d"];

export const TRAY_ICON_LABELS: Record<TrayIconVariant, string> = {
  a: "标准 · 与 Tab 图标同形（无底板）",
  b: "圆角底板 · 同 favicon 外框",
  c: "粗体简化 · 无纸面细节线",
  d: "紧凑 · 更小边距",
};
