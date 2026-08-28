/**
 * Minimal tray visibility test. Run from apps/desktop:
 *   pnpm exec electron scripts/tray-smoke-test.mjs
 */
import { app, Tray, nativeImage, Menu } from "electron";

const RED =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAACTSURBVHgBpZKBCYAgEEV/TeAIjuIIbdQIuUGt0CS1gW1iZ2jIVaTnhw+Cvs8/OYDJA4Y8kR3ZR2/kmazxJbpUEfQ/Dm/UG7wVwHkjlQdMFfDdJMFaACebnjJGyDWgcnZu1/lrCrl6NCoEHJBrDwEr5NrT6ko/UV8xdLAC2N49mlc5CylpYh8wCwqrvbBGLoKGvz8Bfq0QPWEUo/EAAAAASUVORK5CYII=";

app.whenReady().then(() => {
  const raw = nativeImage.createFromDataURL(RED);
  const icon = raw.resize({ width: 16, height: 16, quality: "best" });
  console.log("[smoke] icon size", icon.getSize(), "empty", icon.isEmpty(), "template", icon.isTemplateImage());

  const tray = new Tray(icon);
  tray.setTitle("PH");
  tray.setToolTip("PrintHub tray smoke test");
  tray.setContextMenu(
    Menu.buildFromTemplate([{ label: "Quit smoke test", click: () => app.quit() }]),
  );
  console.log("[smoke] tray created — look for red dot + PH in menu bar");
});
