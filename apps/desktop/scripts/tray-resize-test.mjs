import { app, nativeImage, Tray, Menu } from "electron";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const iconPath = join(here, "../assets/trayTemplate.png");

function report(label, image) {
  const size = image.getSize();
  console.log(
    `[test] ${label}: ${size.width}x${size.height} empty=${image.isEmpty()} template=${image.isTemplateImage()}`,
  );
}

app.whenReady().then(() => {
  const fromPath = nativeImage.createFromPath(iconPath);
  report("fromPath", fromPath);

  const fromBuf = nativeImage.createFromBuffer(readFileSync(iconPath));
  report("fromBuffer", fromBuf);

  const resizedPath = fromPath.resize({ width: 16, height: 16, quality: "best" });
  report("fromPath.resize(16)", resizedPath);

  const resizedBuf = fromBuf.resize({ width: 16, height: 16, quality: "best" });
  report("fromBuffer.resize(16)", resizedBuf);

  const trayImage = fromPath.isEmpty() ? fromBuf : fromPath;
  const tray = new Tray(trayImage);
  tray.setTitle("PH");
  tray.setToolTip("tray resize test");
  tray.setContextMenu(Menu.buildFromTemplate([{ label: "Quit", click: () => app.quit() }]));
  console.log("[test] tray created with un-resized image");
});
