import { nativeImage, nativeTheme, type NativeImage } from "electron";
import type { IconFunction } from "reicon";
import {
  Globe,
  Hashtag,
  Link,
  Logout,
  Menu,
  MirroringScreen,
  Power,
  PowerOff,
  Restart,
  Wifi,
  WifiOff,
} from "reicon";

const ICON_SIZE = 16;

const cache = new Map<string, NativeImage>();

function themeSuffix(): string {
  if (process.platform === "darwin") return "darwin";
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

function strokeColor(): string {
  if (process.platform === "darwin") return "#000";
  return nativeTheme.shouldUseDarkColors ? "#e8eaef" : "#1f2430";
}

function statusGlyphColor(): string {
  if (process.platform === "darwin") return "#1a1a1a";
  return nativeTheme.shouldUseDarkColors ? "#d0d4de" : "#4a5568";
}

function finalizeIcon(image: NativeImage, key: string, template = false): NativeImage {
  if (image.isEmpty()) return image;

  let out = image.resize({ width: ICON_SIZE, height: ICON_SIZE });
  if (out.isEmpty()) return out;

  if (template && process.platform === "darwin") out.setTemplateImage(true);
  cache.set(key, out);
  return out;
}

function reiconIcon(icon: IconFunction, key: string, template = true): NativeImage {
  const cacheKey = `${key}-${themeSuffix()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const svg = icon.toSvg({
    color: strokeColor(),
    size: ICON_SIZE,
    weight: "Outline",
  });
  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  );
  return finalizeIcon(image, cacheKey, template);
}

const TONE_FILL = {
  green: "#3ecf8e",
  yellow: "#f0b429",
  red: "#f07178",
} as const;

type StatusKind = "bridge" | "tcp" | "mdns" | "lan";
type StatusTone = keyof typeof TONE_FILL;

/** Status rows combine a colored dot with a service glyph — kept hand-written. */
function statusRowIcon(kind: StatusKind, tone: StatusTone): NativeImage {
  const key = `status-row-${kind}-${tone}-${themeSuffix()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const glyph = statusGlyphColor();
  const dot = `<circle cx="3.5" cy="8" r="2.75" fill="${TONE_FILL[tone]}"/>`;
  const shapes: Record<StatusKind, string> = {
    bridge: `<rect stroke="${glyph}" stroke-width="1.15" x="7" y="5" width="7.5" height="6" rx="0.9" fill="none"/><path stroke="${glyph}" stroke-width="1.15" stroke-linecap="round" d="M8.5 7.5h4.5M8.5 9.2h3"/>`,
    tcp: `<path stroke="${glyph}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" d="M7 8h2l1-1.8L11 8h2.5"/><circle cx="13.5" cy="8" r="0.9" fill="${glyph}"/>`,
    mdns: `<circle stroke="${glyph}" stroke-width="1.15" cx="10.5" cy="8" r="1.6" fill="none"/><path stroke="${glyph}" stroke-width="1.15" stroke-linecap="round" d="M10.5 5v1M10.5 11v1M7.8 6.2l.8.8M12.2 9.8l.8.8M13.2 6.2l-.8.8M8.8 9.8l-.8.8"/>`,
    lan: `<circle stroke="${glyph}" stroke-width="1.15" cx="10.5" cy="8" r="3.8" fill="none"/><path stroke="${glyph}" stroke-width="1.15" stroke-linecap="round" d="M7 8h7M10.5 5.2a3 3 0 0 1 0 5.6"/>`,
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 16 16" fill="none">${dot}${shapes[kind]}</svg>`;
  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  );
  return finalizeIcon(image, key);
}

export function clearMenuIconCache(): void {
  cache.clear();
}

export const menuIcons = {
  statusHeader: () => reiconIcon(Menu, "status-header"),

  statusRow: statusRowIcon,

  openConsole: () => reiconIcon(MirroringScreen, "open-console"),

  copyLink: () => reiconIcon(Link, "copy-link"),

  lanToggle: (enabled: boolean) =>
    reiconIcon(enabled ? Wifi : WifiOff, enabled ? "lan-on" : "lan-off"),

  httpPort: () => reiconIcon(Hashtag, "http-port"),

  autoLaunch: (enabled: boolean) =>
    reiconIcon(enabled ? Power : PowerOff, enabled ? "auto-on" : "auto-off"),

  restart: () => reiconIcon(Restart, "restart"),

  language: () => reiconIcon(Globe, "language"),

  quit: () => reiconIcon(Logout, "quit"),
};
