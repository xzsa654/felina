import { create } from "zustand";
import type { Locale } from "$lib/i18n";

const STORAGE_KEY = "felina-locale";
const ALLOWED: Locale[] = ["en", "zh-TW"];

function isValidLocale(v: string): v is Locale {
  return (ALLOWED as string[]).includes(v);
}

function loadLocale(): Locale {
  if (typeof localStorage === "undefined") return "en";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && isValidLocale(saved)) return saved;
  // Invalid or missing — fall back to en and overwrite
  if (saved) localStorage.setItem(STORAGE_KEY, "en");
  return "en";
}

function persistLocale(locale: Locale) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, locale);
  }
}

interface LocaleStore {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
}

export const useLocaleStore = create<LocaleStore>((set) => {
  const initial = loadLocale();

  return {
    locale: initial,
    setLocale: (l) =>
      set(() => {
        persistLocale(l);
        return { locale: l };
      }),
    toggleLocale: () =>
      set((s) => {
        const next: Locale = s.locale === "en" ? "zh-TW" : "en";
        persistLocale(next);
        return { locale: next };
      }),
  };
});

// Convenience shorthands
export function getLocale(): Locale {
  return useLocaleStore.getState().locale;
}

export function setLocale(l: Locale) {
  useLocaleStore.getState().setLocale(l);
}
