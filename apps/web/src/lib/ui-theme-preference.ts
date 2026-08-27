import {
  DEFAULT_UI_THEME_ID,
  resolveUiThemeId,
  type UiThemeId,
} from "./ui-themes.js";

const STORAGE_KEY = "virt-printer.ui-theme";

export function loadUiThemeId(): UiThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const resolved = resolveUiThemeId(raw);
    if (raw !== resolved) {
      try {
        localStorage.setItem(STORAGE_KEY, resolved);
      } catch {
        /* ignore */
      }
    }
    return resolved;
  } catch {
    /* ignore */
  }
  return DEFAULT_UI_THEME_ID;
}

export function saveUiThemeId(id: UiThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function applyUiTheme(id: UiThemeId): void {
  if (id === DEFAULT_UI_THEME_ID) {
    document.documentElement.removeAttribute("data-theme");
    return;
  }
  document.documentElement.dataset.theme = id;
}
