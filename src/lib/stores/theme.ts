import { create } from "zustand";

export type ResolvedTheme = "dark" | "light";
export type ThemePreference = ResolvedTheme | "system";
export type Theme = ThemePreference;

const STORAGE_KEY = "felina-theme";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "dark" || value === "light" || value === "system";
}

function resolveSystemTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

function resolveTheme(theme: ThemePreference): ResolvedTheme {
  return theme === "system" ? resolveSystemTheme() : theme;
}

function applyTheme(preference: ThemePreference) {
  const resolvedTheme = resolveTheme(preference);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, preference);
  }
  return resolvedTheme;
}

interface ThemeStore {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  toggleTheme: () => void;
  setTheme: (t: ThemePreference) => void;
}

export const useThemeStore = create<ThemeStore>((set) => {
  const stored =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(STORAGE_KEY)
      : null;
  const initial: ThemePreference = isThemePreference(stored) ? stored : "dark";
  const initialResolved = applyTheme(initial);

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      const state = useThemeStore.getState();
      if (state.theme === "system") {
        const resolvedTheme = resolveSystemTheme();
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", resolvedTheme);
        }
        set({ resolvedTheme });
      }
    };
    media.addEventListener?.("change", handleSystemChange);
    media.addListener?.(handleSystemChange);
  }

  return {
    theme: initial,
    resolvedTheme: initialResolved,
    toggleTheme: () =>
      set((s) => {
        const next: ThemePreference =
          s.theme === "dark" ? "light" : s.theme === "light" ? "system" : "dark";
        const resolvedTheme = applyTheme(next);
        return { theme: next, resolvedTheme };
      }),
    setTheme: (t) =>
      set(() => {
        const resolvedTheme = applyTheme(t);
        return { theme: t, resolvedTheme };
      }),
  };
});

// Convenience shorthands
export function toggleTheme() {
  useThemeStore.getState().toggleTheme();
}

export function setTheme(t: ThemePreference) {
  useThemeStore.getState().setTheme(t);
}

export function getTheme(): ThemePreference {
  return useThemeStore.getState().theme;
}

export function getResolvedTheme(): ResolvedTheme {
  return useThemeStore.getState().resolvedTheme;
}
