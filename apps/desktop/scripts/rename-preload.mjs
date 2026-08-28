import { existsSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(desktopRoot, "dist/preload.js");
const to = join(desktopRoot, "dist/preload.cjs");

if (!existsSync(from)) {
  console.error("[desktop] dist/preload.js not found — run tsc -p tsconfig.preload.json first");
  process.exit(1);
}

renameSync(from, to);
