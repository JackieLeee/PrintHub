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
import { isDesktopApp } from "../lib/is-desktop.js";

const STORAGE_KEY = "virt-printer-locale";

const catalogs: Record<Locale, Translations> = { zh, en };

function resolveSystemLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of langs) {
    if (!lang) continue;
    if (lang.toLowerCase().startsWith("zh")) return "zh";
  }
  return "en";
}

function readInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "zh") return saved;
  return resolveSystemLocale();
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

  useEffect(() => {
    if (!isDesktopApp()) return;
    void window.printhubDesktop?.getUiLocale().then((saved) => {
      const stored = localStorage.getItem(STORAGE_KEY);
      const fromStorage = stored === "en" || stored === "zh" ? stored : null;
      if (fromStorage) {
        setLocaleState(fromStorage);
        if (fromStorage !== saved) {
          void window.printhubDesktop?.setUiLocale(fromStorage);
        }
        return;
      }
      if (saved === "en" || saved === "zh") {
        setLocaleState(saved);
        localStorage.setItem(STORAGE_KEY, saved);
      }
    });
  }, []);

  useEffect(() => {
    if (!isDesktopApp()) return;
    return window.printhubDesktop?.onUiLocaleChanged((next) => {
      if (next === "en" || next === "zh") {
        setLocaleState(next);
        localStorage.setItem(STORAGE_KEY, next);
      }
    });
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    if (isDesktopApp()) {
      void window.printhubDesktop?.setUiLocale(next);
    }
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
