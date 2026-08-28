import { nativeImage, nativeTheme, type NativeImage } from "electron";

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

function strokeAttrs(): string {
  return `stroke="${strokeColor()}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"`;
}

function finalizeIcon(image: NativeImage, key: string, template = false): NativeImage {
  if (image.isEmpty()) return image;

  let out = image.resize({ width: ICON_SIZE, height: ICON_SIZE });
  if (out.isEmpty()) return out;

  if (template && process.platform === "darwin") out.setTemplateImage(true);
  cache.set(key, out);
  return out;
}

function strokeIcon(body: string, key: string): NativeImage {
  const cacheKey = `${key}-${themeSuffix()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 16 16" fill="none">${body}</svg>`;
  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  );
  return finalizeIcon(image, cacheKey, true);
}

function fillIcon(body: string, key: string): NativeImage {
  const cacheKey = `${key}-${themeSuffix()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 16 16">${body}</svg>`;
  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  );
  return finalizeIcon(image, cacheKey, false);
}

const TONE_FILL = {
  green: "#3ecf8e",
  yellow: "#f0b429",
  red: "#f07178",
} as const;

type StatusKind = "bridge" | "tcp" | "mdns" | "lan";
type StatusTone = keyof typeof TONE_FILL;

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
  statusHeader: () =>
    strokeIcon(`<path ${strokeAttrs()} d="M2 4h12M2 8h12M2 12h8"/>`, "status-header"),

  statusRow: statusRowIcon,

  statusDot: (tone: StatusTone) => {
    const fill = TONE_FILL[tone];
    return fillIcon(`<circle cx="8" cy="8" r="4.5" fill="${fill}"/>`, `status-${tone}`);
  },

  bridge: () =>
    strokeIcon(
      `<rect ${strokeAttrs()} x="3" y="4" width="10" height="8" rx="1"/><path ${strokeAttrs()} d="M5 7h6M5 9.5h4"/>`,
      "bridge",
    ),

  tcp: () =>
    strokeIcon(
      `<path ${strokeAttrs()} d="M3 8h3l1.5-2.5L9 8h4"/><circle cx="12.5" cy="8" r="1" fill="${strokeColor()}"/>`,
      "tcp",
    ),

  mdns: () =>
    strokeIcon(
      `<circle ${strokeAttrs()} cx="8" cy="8" r="2"/><path ${strokeAttrs()} d="M8 2.5v1.5M8 12v1.5M2.5 8H4M12 8h1.5M4.2 4.2l1 1M10.8 10.8l1 1M11.8 4.2l-1 1M5.2 10.8l-1 1"/>`,
      "mdns",
    ),

  lan: () =>
    strokeIcon(
      `<circle ${strokeAttrs()} cx="8" cy="8" r="5.5"/><path ${strokeAttrs()} d="M2 8h12M8 2.5a4.2 4.2 0 0 1 0 11"/>`,
      "lan",
    ),

  openConsole: () =>
    strokeIcon(
      `<rect ${strokeAttrs()} x="2.5" y="3" width="11" height="9" rx="1"/><path ${strokeAttrs()} d="M5 6.5 6.8 8 5 9.5"/>`,
      "open-console",
    ),

  copyLink: () =>
    strokeIcon(
      `<path ${strokeAttrs()} d="M6 9.5H4.8a1.8 1.8 0 0 1 0-3.6H6"/><path ${strokeAttrs()} d="M10 6.5h1.2a1.8 1.8 0 0 1 0 3.6H10"/><path ${strokeAttrs()} d="M6.2 8h3.6"/>`,
      "copy-link",
    ),

  lanToggle: (enabled: boolean) =>
    strokeIcon(
      enabled
        ? `<path ${strokeAttrs()} d="M2.5 8a5.5 5.5 0 0 1 11 0"/><path ${strokeAttrs()} d="M8 5v6"/><path ${strokeAttrs()} d="M6 11h4"/>`
        : `<path ${strokeAttrs()} d="M2.5 8a5.5 5.5 0 0 1 11 0"/><path ${strokeAttrs()} d="M4 4l8 8"/>`,
      enabled ? "lan-on" : "lan-off",
    ),

  httpPort: () =>
    strokeIcon(
      `<path ${strokeAttrs()} d="M5 4h6M5 8h6M5 12h3"/><circle cx="11.5" cy="12" r="1.2" fill="${strokeColor()}"/>`,
      "http-port",
    ),

  autoLaunch: (enabled: boolean) =>
    strokeIcon(
      enabled
        ? `<path ${strokeAttrs()} d="M8 2.5v4M6.5 11.5h3"/><circle ${strokeAttrs()} cx="8" cy="8.5" r="5"/>`
        : `<circle ${strokeAttrs()} cx="8" cy="8.5" r="5"/><path ${strokeAttrs()} d="M6 8.5h4"/>`,
      enabled ? "auto-on" : "auto-off",
    ),

  restart: () =>
    strokeIcon(
      `<path ${strokeAttrs()} d="M11 2.5A5.5 5.5 0 1 0 13 8"/><path ${strokeAttrs()} d="M11 2.5V6h-3.5"/>`,
      "restart",
    ),

  language: () =>
    strokeIcon(
      `<circle ${strokeAttrs()} cx="8" cy="8" r="5.5"/><path ${strokeAttrs()} d="M2.5 8h11"/><path ${strokeAttrs()} d="M8 2.5c1.4 1.8 2.1 3.6 2.1 5.5S9.4 11.7 8 13.5c-1.4-1.8-2.1-3.6-2.1-5.5S6.6 4.3 8 2.5z"/>`,
      "language",
    ),

  quit: () =>
    strokeIcon(
      `<path ${strokeAttrs()} d="M6 3.5h4v5H6z"/><path ${strokeAttrs()} d="M4.5 8.5h7"/><path ${strokeAttrs()} d="M8 8.5v4.5"/>`,
      "quit",
    ),
};
