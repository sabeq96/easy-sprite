import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { DefaultsSection } from "@/components/settings/DefaultsSection";
import { SETTING_KEYS } from "@/constants/settings";
import { readSetting } from "@/db/repositories/settings";
import { useDefaultsStore } from "@/stores/useDefaultsStore";
import { render } from "@test/render";

const storedRow = () => readSetting<Record<string, unknown>>(SETTING_KEYS.defaults, {});

test("a change persists and enables that group's reset", async () => {
  const screen = await render(<DefaultsSection />);
  const reset = screen.getByRole("button", { name: "Reset grid and checkerboard to default" });
  await expect.element(reset).toBeDisabled();

  await userEvent.click(screen.getByRole("switch", { name: "Show grid" }));
  await userEvent.click(screen.getByRole("group", { name: "Grid size" }).getByRole("button", { name: "8" }));

  await expect.poll(storedRow).toEqual({ gridEnabled: false, gridSize: 8 });
  await expect.element(reset).toBeEnabled();
  // Other groups are untouched, so their resets stay off.
  await expect
    .element(screen.getByRole("button", { name: "Reset animation to default" }))
    .toBeDisabled();
});

test("reset returns the group to its built-in values", async () => {
  const screen = await render(<DefaultsSection />);
  await userEvent.click(screen.getByRole("button", { name: "32×32" }));
  await expect.poll(storedRow).toEqual({ tileSize: 32 });

  const reset = screen.getByRole("button", { name: "Reset new sprites and sheets to default" });
  await userEvent.click(reset);

  await expect.poll(storedRow).toEqual({});
  await expect.element(screen.getByRole("button", { name: "16×16" })).toHaveAttribute("aria-pressed", "true");
  await expect.element(reset).toBeDisabled();
  expect(useDefaultsStore.getState().defaults.tileSize).toBe(16);
});
