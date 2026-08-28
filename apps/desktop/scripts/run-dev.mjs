/**
 * macOS 26+ requires a real .app bundle (CFBundleIdentifier) for menu bar items.
 * Raw `electron .` never appears in System Settings → Menu Bar.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureElectron } from "./ensure-electron.mjs";

const desktopRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const require = createRequire(import.meta.url);

function spawnPnpm(args) {
  const cmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  return execFileSync(cmd, args, { cwd: desktopRoot, stdio: "inherit" });
}

function findPrintHubApp(dir) {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "PrintHub.app" && statSync(full).isDirectory()) return full;
    if (statSync(full).isDirectory()) {
      const nested = findPrintHubApp(full);
      if (nested) return nested;
    }
  }
  return null;
}

function runDarwinPackaged() {
  console.log("[desktop] macOS: building PrintHub.app (required for menu bar on macOS 26+)…");
  spawnPnpm(["icons"]);
  spawnPnpm(["exec", "electron-builder", "--dir"]);

  const appPath = findPrintHubApp(join(desktopRoot, "release"));
  if (!appPath) {
    console.error("[desktop] PrintHub.app not found under release/");
    process.exit(1);
  }

  console.log("[desktop] launching", appPath);
  spawnSync("open", ["-n", appPath], { stdio: "inherit" });
}

function runDirectElectron() {
  ensureElectron();
  const electronPath = require("electron");
  const result = spawnSync(electronPath, ["."], {
    cwd: desktopRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error("[desktop] failed to launch Electron:", result.error);
    process.exit(1);
  }
  process.exit(result.status ?? 0);
}

if (process.platform === "darwin") {
  runDarwinPackaged();
} else {
  runDirectElectron();
}
