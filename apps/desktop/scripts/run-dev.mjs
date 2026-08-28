/**
 * macOS 26+ requires a real .app bundle (CFBundleIdentifier) for menu bar items.
 * Raw `electron .` never appears in System Settings → Menu Bar.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

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
  execFileSync("pnpm", ["icons"], { cwd: desktopRoot, stdio: "inherit" });
  execFileSync("pnpm", ["exec", "electron-builder", "--dir"], {
    cwd: desktopRoot,
    stdio: "inherit",
  });

  const appPath = findPrintHubApp(join(desktopRoot, "release"));
  if (!appPath) {
    console.error("[desktop] PrintHub.app not found under release/");
    process.exit(1);
  }

  console.log("[desktop] launching", appPath);
  spawnSync("open", ["-n", appPath], { stdio: "inherit" });
}

function runDirectElectron() {
  execFileSync("pnpm", ["exec", "electron", "."], {
    cwd: desktopRoot,
    stdio: "inherit",
  });
}

if (process.platform === "darwin") {
  runDarwinPackaged();
} else {
  runDirectElectron();
}
