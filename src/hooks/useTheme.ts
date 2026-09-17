import { useEffect } from "react";
import { THEME_STORAGE_KEY } from "@/constants/settings";
import { useThemeStore } from "@/stores/useThemeStore";

/**
 * Applies the theme to <html> and persists it. Mounted once at the app root — the editor
 * route lives outside the shell layout, so this cannot belong to a nav component.
 */
export function useApplyTheme(): void {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Failing to remember the theme is not worth breaking the app over.
    }
  }, [theme]);
}
