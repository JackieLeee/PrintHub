import { app } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveWebRoot(): string | null {
  const packaged = join(process.resourcesPath, "web");
  if (existsSync(join(packaged, "index.html"))) return packaged;

  const appPath = app.getAppPath();
  const candidates = [
    join(appPath, "../web/dist"),
    join(appPath, "../../web/dist"),
    join(appPath, "../../../apps/web/dist"),
    join(fileURLToPath(new URL(".", import.meta.url)), "../../../web/dist"),
    join(fileURLToPath(new URL(".", import.meta.url)), "../../../../apps/web/dist"),
  ];

  for (const dir of candidates) {
    if (existsSync(join(dir, "index.html"))) return dir;
  }
  return null;
}

export function resolvePreloadPath(): string {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const cjs = join(here, "preload.cjs");
  if (existsSync(cjs)) return cjs;
  return join(here, "preload.js");
}

export function resolveWebIndexPath(): string | null {
  const root = resolveWebRoot();
  if (!root) return null;
  const index = join(root, "index.html");
  return existsSync(index) ? index : null;
}

export function resolveAppIconPath(): string | null {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const packaged = join(process.resourcesPath, "assets");
  const candidates = [
    join(packaged, "icon.png"),
    join(app.getAppPath(), "../assets/icon.png"),
    join(app.getAppPath(), "../../assets/icon.png"),
    join(here, "../assets/icon.png"),
    join(here, "../../assets/icon.png"),
    join(app.getAppPath(), "../web/public/favicon.svg"),
    join(app.getAppPath(), "../../web/public/favicon.svg"),
    join(here, "../../../web/public/favicon.svg"),
    join(here, "../../../../apps/web/public/favicon.svg"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}
