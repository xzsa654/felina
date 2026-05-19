import { create } from "zustand";

export type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("glyphic-theme", theme);
  }
}

interface ThemeStore {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeStore>((set) => {
  const initial: Theme =
    (typeof localStorage !== "undefined" &&
      (localStorage.getItem("glyphic-theme") as Theme)) ||
    "dark";

  if (typeof document !== "undefined") {
    applyTheme(initial);
  }

  return {
    theme: initial,
    toggleTheme: () =>
      set((s) => {
        const next: Theme = s.theme === "dark" ? "light" : "dark";
        applyTheme(next);
        return { theme: next };
      }),
    setTheme: (t) =>
      set(() => {
        applyTheme(t);
        return { theme: t };
      }),
  };
});

// Convenience shorthands
export function toggleTheme() {
  useThemeStore.getState().toggleTheme();
}

export function setTheme(t: Theme) {
  useThemeStore.getState().setTheme(t);
}

export function getTheme(): Theme {
  return useThemeStore.getState().theme;
}
