import { useCallback, useEffect, useState } from "react";
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

export interface ThemeControls {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export function useTheme(): ThemeControls {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Not being able to remember the theme is not worth breaking the app over.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { theme, setTheme, toggle };
}
