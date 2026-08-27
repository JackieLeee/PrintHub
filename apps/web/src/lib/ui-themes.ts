export type UiThemeId =
  | "cursor"
  | "linear"
  | "vercel"
  | "supabase"
  | "raycast"
  | "notion"
  | "stripe"
  | "ibm-carbon"
  | "resend"
  | "voltagent";

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

export const DEFAULT_UI_THEME_ID: UiThemeId = "cursor";

export const UI_THEMES: UiTheme[] = [
  {
    id: "cursor",
    name: "Cursor IDE",
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
    id: "linear",
    name: "Linear",
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
    id: "vercel",
    name: "Vercel",
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
      font: '"Geist", "SF Pro Text", system-ui, sans-serif',
    },
  },
  {
    id: "supabase",
    name: "Supabase",
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
    id: "raycast",
    name: "Raycast",
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
    id: "notion",
    name: "Notion",
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
    id: "stripe",
    name: "Stripe",
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
    id: "ibm-carbon",
    name: "IBM Carbon",
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
    id: "resend",
    name: "Resend",
    tokens: {
      bg: "#09090b",
      surface: "#0f0f12",
      surface2: "#18181c",
      border: "#27272a",
      text: "#fafafa",
      muted: "#71717a",
      accent: "#ffffff",
      ok: "#22c55e",
      warn: "#eab308",
      err: "#ef4444",
      font: '"Inter", "SF Mono", ui-monospace, monospace',
    },
  },
  {
    id: "voltagent",
    name: "VoltAgent",
    tokens: {
      bg: "#050505",
      surface: "#0c0c0c",
      surface2: "#141414",
      border: "#262626",
      text: "#e5e5e5",
      muted: "#737373",
      accent: "#10b981",
      ok: "#10b981",
      warn: "#f59e0b",
      err: "#ef4444",
      font: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
    },
  },
];

export function isUiThemeId(value: string): value is UiThemeId {
  return UI_THEMES.some((theme) => theme.id === value);
}
