export type UiThemeId =
  | "deep-ink"
  | "violet-night"
  | "carbon-black"
  | "forest-green"
  | "warm-rose"
  | "plain-paper"
  | "deep-ocean"
  | "steel-blue"
  | "amber-glow"
  | "celadon";

export interface UiThemeTokens {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  ok: string;
  warn: string;
  err: string;
  font: string;
}

export interface UiTheme {
  id: UiThemeId;
  name: string;
  tokens: UiThemeTokens;
}

export const DEFAULT_UI_THEME_ID: UiThemeId = "deep-ink";

/** Maps legacy theme ids from localStorage to the new naming scheme. */
export const LEGACY_THEME_ID_MAP: Record<string, UiThemeId> = {
  cursor: "deep-ink",
  linear: "violet-night",
  vercel: "carbon-black",
  supabase: "forest-green",
  raycast: "warm-rose",
  notion: "plain-paper",
  stripe: "deep-ocean",
  "ibm-carbon": "steel-blue",
  resend: "carbon-black",
  voltagent: "celadon",
};

export const UI_THEMES: UiTheme[] = [
  {
    id: "deep-ink",
    name: "深墨",
    tokens: {
      bg: "#0f1117",
      surface: "#171a22",
      surface2: "#1e2230",
      border: "#2a3142",
      text: "#e8eaef",
      muted: "#8b93a7",
      accent: "#4c8dff",
      ok: "#3ecf8e",
      warn: "#f0b429",
      err: "#f07178",
      font: '"SF Pro Text", "Segoe UI", system-ui, sans-serif',
    },
  },
  {
    id: "violet-night",
    name: "紫夜",
    tokens: {
      bg: "#0b0b0f",
      surface: "#13131a",
      surface2: "#1a1a24",
      border: "#2a2a38",
      text: "#ececf1",
      muted: "#8b8b9a",
      accent: "#8b5cf6",
      ok: "#34d399",
      warn: "#fbbf24",
      err: "#f87171",
      font: '"Inter", "SF Pro Text", system-ui, sans-serif',
    },
  },
  {
    id: "carbon-black",
    name: "碳黑",
    tokens: {
      bg: "#000000",
      surface: "#0a0a0a",
      surface2: "#111111",
      border: "#333333",
      text: "#ededed",
      muted: "#888888",
      accent: "#0070f3",
      ok: "#50e3c2",
      warn: "#f5a623",
      err: "#ee0000",
      font: '"SF Pro Text", system-ui, sans-serif',
    },
  },
  {
    id: "forest-green",
    name: "森绿",
    tokens: {
      bg: "#0c0f0e",
      surface: "#121816",
      surface2: "#181f1c",
      border: "#2a3530",
      text: "#e6eee9",
      muted: "#7f9488",
      accent: "#3ecf8e",
      ok: "#3ecf8e",
      warn: "#f0b429",
      err: "#ff6b6b",
      font: '"Inter", "SF Pro Text", system-ui, sans-serif',
    },
  },
  {
    id: "warm-rose",
    name: "暖玫",
    tokens: {
      bg: "#1a1a1c",
      surface: "#212124",
      surface2: "#2a2a2e",
      border: "#3a3a40",
      text: "#f0f0f5",
      muted: "#9a9aa5",
      accent: "#ff6363",
      ok: "#4ade80",
      warn: "#facc15",
      err: "#fb7185",
      font: '"SF Pro Text", "Segoe UI", system-ui, sans-serif',
    },
  },
  {
    id: "plain-paper",
    name: "素纸",
    tokens: {
      bg: "#191919",
      surface: "#202020",
      surface2: "#2a2a2a",
      border: "#3d3d3d",
      text: "#ebebeb",
      muted: "#9b9b9b",
      accent: "#2383e2",
      ok: "#4dab7f",
      warn: "#d9730d",
      err: "#e03e3e",
      font: '"Inter", "SF Pro Text", system-ui, sans-serif',
    },
  },
  {
    id: "deep-ocean",
    name: "深海",
    tokens: {
      bg: "#0a2540",
      surface: "#0f3058",
      surface2: "#133d6e",
      border: "#1e4d7b",
      text: "#f6f9fc",
      muted: "#a3b8cc",
      accent: "#635bff",
      ok: "#30d158",
      warn: "#ffbb00",
      err: "#df1b41",
      font: '"Inter", "SF Pro Text", system-ui, sans-serif',
    },
  },
  {
    id: "steel-blue",
    name: "钢蓝",
    tokens: {
      bg: "#161616",
      surface: "#1c1c1c",
      surface2: "#262626",
      border: "#393939",
      text: "#f4f4f4",
      muted: "#a8a8a8",
      accent: "#4589ff",
      ok: "#42be65",
      warn: "#f1c21b",
      err: "#fa4d56",
      font: '"IBM Plex Sans", "SF Pro Text", system-ui, sans-serif',
    },
  },
  {
    id: "amber-glow",
    name: "琥珀",
    tokens: {
      bg: "#14110e",
      surface: "#1c1814",
      surface2: "#252018",
      border: "#3d3428",
      text: "#f0ebe3",
      muted: "#9a8f7f",
      accent: "#e8a838",
      ok: "#6bbf59",
      warn: "#e8a838",
      err: "#d45d5d",
      font: 'Georgia, "SF Pro Text", system-ui, serif',
    },
  },
  {
    id: "celadon",
    name: "青瓷",
    tokens: {
      bg: "#0e1211",
      surface: "#151a19",
      surface2: "#1c2321",
      border: "#2a3532",
      text: "#e2ebe8",
      muted: "#7a9089",
      accent: "#5eb8a8",
      ok: "#5eb8a8",
      warn: "#c9a227",
      err: "#c96b6b",
      font: '"Noto Sans SC", "SF Pro Text", system-ui, sans-serif',
    },
  },
];

export function isUiThemeId(value: string): value is UiThemeId {
  return UI_THEMES.some((theme) => theme.id === value);
}

export function resolveUiThemeId(raw: string | null | undefined): UiThemeId {
  if (raw && isUiThemeId(raw)) return raw;
  if (raw && raw in LEGACY_THEME_ID_MAP) return LEGACY_THEME_ID_MAP[raw]!;
  return DEFAULT_UI_THEME_ID;
}
