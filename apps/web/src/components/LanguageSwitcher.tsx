import { useLocale } from "../i18n/context.js";
import type { Locale } from "../i18n/types.js";

const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇺🇸",
  zh: "🇨🇳",
};

function GlobeIcon() {
  return (
    <svg
      className="lang-globe-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

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
      <GlobeIcon />
      <select
        className={`lang-select${compact ? " header-toolbar-select" : ""}`}
        value={locale}
        aria-label={t.lang.label}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        <option value="en">{compact ? LOCALE_LABELS.en : `${LOCALE_FLAGS.en} ${t.lang.en}`}</option>
        <option value="zh">{compact ? LOCALE_LABELS.zh : `${LOCALE_FLAGS.zh} ${t.lang.zh}`}</option>
      </select>
    </label>
  );
}
