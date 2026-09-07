import { useEffect, useState } from "react";
import { useLocale } from "../i18n/context.js";
import { Icon } from "./Icon.js";
import { HeaderMenuSelect } from "./HeaderMenuSelect.js";
import {
  applyUiTheme,
  loadUiThemeId,
  saveUiThemeId,
} from "../lib/ui-theme-preference.js";
import { UI_THEMES, type UiThemeId } from "../lib/ui-themes.js";

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();
  const [themeId, setThemeId] = useState<UiThemeId>(() => loadUiThemeId());

  useEffect(() => {
    applyUiTheme(themeId);
  }, [themeId]);

  return (
    <label
      className={`lang-select-wrap${compact ? " header-toolbar-control" : ""}`}
      title={t.theme.label}
    >
      <Icon name="palette" className="lang-globe-icon" />
      {compact ? (
        <HeaderMenuSelect
          value={themeId}
          ariaLabel={t.theme.label}
          align="end"
          options={UI_THEMES.map((theme) => ({
            value: theme.id,
            label: t.theme.names[theme.id],
          }))}
          onChange={(next) => {
            const id = next as UiThemeId;
            setThemeId(id);
            saveUiThemeId(id);
          }}
        />
      ) : (
        <select
          className="lang-select"
          value={themeId}
          aria-label={t.theme.label}
          onChange={(e) => {
            const next = e.target.value as UiThemeId;
            setThemeId(next);
            saveUiThemeId(next);
          }}
        >
          {UI_THEMES.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {t.theme.names[theme.id]}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}
