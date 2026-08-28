/**
 * Build macOS icon.icns + icon.png from apps/web/public/favicon.svg
 * Requires: sharp (devDependency), macOS iconutil + sips for .icns
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const desktopRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const svgPath = join(desktopRoot, "../web/public/favicon.svg");
const assetsDir = join(desktopRoot, "assets");
const pngPath = join(assetsDir, "icon.png");
const iconsetDir = join(assetsDir, "icon.iconset");
const icnsPath = join(assetsDir, "icon.icns");

const sizes = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024],
];

const svg = readFileSync(svgPath);
mkdirSync(assetsDir, { recursive: true });

await sharp(svg).resize(1024, 1024).png().toFile(pngPath);
console.log("[icon] wrote", pngPath);

rmSync(iconsetDir, { recursive: true, force: true });
mkdirSync(iconsetDir, { recursive: true });

for (const [name, size] of sizes) {
  const out = join(iconsetDir, name);
  await sharp(svg).resize(size, size).png().toFile(out);
}

if (process.platform === "darwin") {
  execFileSync("iconutil", ["-c", "icns", iconsetDir, "-o", icnsPath], { stdio: "inherit" });
  rmSync(iconsetDir, { recursive: true, force: true });
  console.log("[icon] wrote", icnsPath);
} else {
  writeFileSync(join(assetsDir, ".iconset-stub"), "Run on macOS to produce icon.icns\n");
  console.warn("[icon] skipped icon.icns (iconutil requires macOS); icon.png is ready");
}
