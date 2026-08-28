/**
 * Ensure the Electron binary is downloaded (pnpm may skip electron postinstall).
 *
 * Usage:
 *   node scripts/ensure-electron.mjs          # required — exit 1 on failure
 *   node scripts/ensure-electron.mjs --soft     # postinstall — warn only
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(desktopRoot, "package.json"));

const CN_MIRROR = "https://npmmirror.com/mirrors/electron/";

function getElectronDir() {
  return dirname(require.resolve("electron/package.json"));
}

function isElectronInstalled() {
  try {
    require("electron");
    return true;
  } catch {
    return false;
  }
}

function runElectronInstall(electronDir, env) {
  return spawnSync(process.execPath, [join(electronDir, "install.js")], {
    cwd: electronDir,
    stdio: "inherit",
    env,
  });
}

function printFailureHint() {
  console.error(
    "[desktop] Electron install failed (network / firewall / GitHub blocked).\n" +
      "  Mirror (Git Bash):\n" +
      "    export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/\n" +
      "    pnpm --filter @virt-printer/desktop run install:electron\n" +
      "  Mirror (PowerShell):\n" +
      "    $env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'\n" +
      "    pnpm --filter @virt-printer/desktop run install:electron\n" +
      "  Or: pnpm rebuild electron",
  );
}

/**
 * @param {{ soft?: boolean }} opts
 * @returns {boolean} true when Electron is ready
 */
export function ensureElectron({ soft = false } = {}) {
  if (isElectronInstalled()) return true;

  const electronDir = getElectronDir();
  console.log("[desktop] Electron binary missing — downloading (first run may take a few minutes)…");

  let result = runElectronInstall(electronDir, process.env);

  if (result.status !== 0 && !isElectronInstalled() && !process.env.ELECTRON_MIRROR) {
    console.log(`[desktop] Retrying via npmmirror (${CN_MIRROR})…`);
    result = runElectronInstall(electronDir, {
      ...process.env,
      ELECTRON_MIRROR: CN_MIRROR,
    });
  }

  if (isElectronInstalled()) return true;

  printFailureHint();
  if (!soft) process.exit(result.status ?? 1);
  return false;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const soft = process.argv.includes("--soft");
  const ok = ensureElectron({ soft });
  if (!ok && soft) {
    console.warn("[desktop] Skipping Electron download for now — run install:electron before dev:desktop.");
    process.exit(0);
  }
}
