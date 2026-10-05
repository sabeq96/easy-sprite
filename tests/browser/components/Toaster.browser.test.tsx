import { expect, test } from "vitest";
import { toast } from "sonner";
import { useThemeStore } from "@/stores/useThemeStore";
import { render } from "@test/render";

// Both themes, so one of them always differs from whatever the system prefers.
test.each(["light", "dark"] as const)("a toast follows the app's %s theme, not the system's", async (theme) => {
  useThemeStore.getState().setTheme(theme);
  // The app's own Toaster comes with the providers, so there is nothing else to mount.
  const screen = await render(null);

  toast("Saved");

  await expect.element(screen.getByText("Saved")).toBeVisible();
  expect(document.querySelector("[data-sonner-toaster]")).toHaveAttribute("data-sonner-theme", theme);
});
