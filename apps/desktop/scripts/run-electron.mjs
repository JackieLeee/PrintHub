/**
 * Launch Electron with a path resolved from node_modules (works on Windows/macOS/Linux).
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureElectron } from "./ensure-electron.mjs";

const desktopRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const require = createRequire(import.meta.url);

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
