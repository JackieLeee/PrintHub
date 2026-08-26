import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en } from "./locales/en.js";
import { zh } from "./locales/zh.js";
import type { Locale, Translations } from "./types.js";

const STORAGE_KEY = "virt-printer-locale";

const catalogs: Record<Locale, Translations> = { zh, en };

function readInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang");
  if (lang === "en" || lang === "zh") return lang;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "zh") return saved;
  return "en";
}

interface LocaleContextValue {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
  format: (template: string, vars: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const format = useCallback((template: string, vars: Record<string, string | number>) => {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: catalogs[locale],
      setLocale,
      format,
    }),
    [locale, setLocale, format],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
