import { expect, test } from "vitest";
import { toast } from "sonner";
import { useThemeStore } from "@/stores/useThemeStore";
import { render } from "@test/render";

test("a toast follows the app's theme, not the system's", async () => {
  useThemeStore.getState().setTheme("dark");
  // The app's own Toaster comes with the providers, so there is nothing else to mount.
  const screen = await render(null);

  toast("Saved");

  await expect.element(screen.getByText("Saved")).toBeVisible();
  expect(document.querySelector("[data-sonner-toaster]")).toHaveAttribute("data-sonner-theme", "dark");
});
