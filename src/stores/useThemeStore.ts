import { create } from "zustand";
import { THEME_STORAGE_KEY } from "@/constants/settings";

export type Theme = "light" | "dark";

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "dark";
  } catch {
    // Private mode or blocked storage: dark is the default either way.
    return "dark";
  }
}

export interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => set({ theme }),
  toggle: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
}));
