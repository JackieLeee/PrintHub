import { isDesktopApp, isDesktopShell } from "./is-desktop";

/** Apply platform classes for Electron shell integration. */
export function applyDesktopChrome(): void {
  if (!isDesktopShell() && !isDesktopApp()) return;

  const chrome = window.printhubDesktop?.windowChrome;
  if (chrome === "traffic-lights") {
    document.documentElement.classList.add("desktop-custom-chrome");
    document.documentElement.classList.remove("desktop-win");
    const height = window.printhubDesktop?.titleBarOverlayHeight ?? 40;
    document.documentElement.style.setProperty("--desktop-titlebar-height", `${height}px`);
    return;
  }

  if (window.printhubDesktop?.platform === "win32" && window.printhubDesktop.titleBarOverlay) {
    document.documentElement.classList.add("desktop-win");
    document.documentElement.classList.remove("desktop-custom-chrome");
    const height = window.printhubDesktop.titleBarOverlayHeight ?? 40;
    document.documentElement.style.setProperty("--desktop-titlebar-height", `${height}px`);
  }
}
