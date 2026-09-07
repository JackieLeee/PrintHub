import { useLocale } from "../i18n/context.js";
import type { Locale } from "../i18n/types.js";
import { Icon } from "./Icon.js";
import { HeaderMenuSelect } from "./HeaderMenuSelect.js";

const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇺🇸",
  zh: "🇨🇳",
};

const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  zh: "中文",
};

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <label
      className={`lang-select-wrap${compact ? " header-toolbar-control" : ""}`}
      title={t.lang.label}
    >
      <Icon name="globe" className="lang-globe-icon" />
      {compact ? (
        <HeaderMenuSelect
          value={locale}
          ariaLabel={t.lang.label}
          align="end"
          options={[
            { value: "en", label: LOCALE_LABELS.en },
            { value: "zh", label: LOCALE_LABELS.zh },
          ]}
          onChange={(next) => setLocale(next as Locale)}
        />
      ) : (
        <select
          className="lang-select"
          value={locale}
          aria-label={t.lang.label}
          onChange={(e) => setLocale(e.target.value as Locale)}
        >
          <option value="en">{`${LOCALE_FLAGS.en} ${t.lang.en}`}</option>
          <option value="zh">{`${LOCALE_FLAGS.zh} ${t.lang.zh}`}</option>
        </select>
      )}
    </label>
  );
}
