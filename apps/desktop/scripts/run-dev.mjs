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

function hostMacArch() {
  return process.arch === "arm64" ? "arm64" : "x64";
}

function packagedAppPath(arch) {
  return join(desktopRoot, "release", `mac-${arch}`, "PrintHub.app");
}

function runDarwinPackaged() {
  const arch = hostMacArch();
  console.log(`[desktop] macOS: building PrintHub.app (${arch}, required for menu bar on macOS 26+)…`);
  spawnPnpm(["icons"]);
  spawnPnpm(["exec", "electron-builder", "install-app-deps"]);
  spawnPnpm(["exec", "electron-builder", "--dir", `--${arch}`]);

  const appPath = packagedAppPath(arch);
  if (!existsSync(appPath)) {
    // Fallback for older release/ layout (mac/ = x64, mac-arm64/ = arm64).
    const legacyPath = findPrintHubApp(join(desktopRoot, "release"));
    if (!legacyPath) {
      console.error(`[desktop] PrintHub.app not found at ${appPath}`);
      process.exit(1);
    }
    console.warn("[desktop] using legacy release path:", legacyPath);
    console.log("[desktop] launching", legacyPath);
    spawnSync("open", ["-n", legacyPath], { stdio: "inherit" });
    return;
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
