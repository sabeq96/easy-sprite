import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { AppRoutes } from "@/app/routes";
import { createPalette } from "@/db/repositories/palettes";
import { createSprite, listSprites } from "@/db/repositories/sprites";
import { createSpritesheet } from "@/db/repositories/spritesheets";
import { useAnimationStore } from "@/editor/animation/api";
import { usePaletteStore } from "@/editor/palette/api";
import { useViewStore } from "@/editor/view/api";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";
import { useDefaultsStore, type DefaultsState } from "@/stores/useDefaultsStore";
import { render } from "@test/render";

const setDefaults = (values: Partial<DefaultsState["defaults"]>) => {
  for (const [key, value] of Object.entries(values)) {
    useDefaultsStore.getState().set(key as keyof typeof values, value as never);
  }
};

const openSprite = async (id: string) => {
  const screen = await render(<AppRoutes />, { route: `/sprites/${id}` });
  await expect.element(screen.getByRole("application", { name: "Sprite canvas" })).toBeVisible();
  return screen;
};

test("new sprite and new spritesheet dialogs start from the defaults", async () => {
  setDefaults({ tileSize: 32, spriteColumns: 3, spriteRows: 1 });
  const screen = await render(<AppRoutes />, { route: "/library" });

  await userEvent.click(screen.getByRole("button", { name: "New sprite", exact: true }).first());
  await expect.element(screen.getByRole("button", { name: "32×32" })).toHaveAttribute("aria-pressed", "true");
  await expect.element(screen.getByLabelText("Columns")).toHaveValue(3);
  await expect.element(screen.getByLabelText("Rows")).toHaveValue(1);
  await userEvent.click(screen.getByRole("button", { name: "Create" }));

  await expect.element(screen.getByRole("application", { name: "Sprite canvas" })).toBeVisible();
  const [sprite] = await listSprites();
  expect([sprite.width, sprite.height, sprite.tileSize]).toEqual([96, 32, 32]);

  await userEvent.click(screen.getByRole("button", { name: "Back to library" }));
  await userEvent.click(screen.getByRole("button", { name: "More ways to create" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "New spritesheet" }));
  await expect.element(screen.getByRole("button", { name: "32×32" })).toHaveAttribute("aria-pressed", "true");
});

test("opening a sprite applies the defaults", async () => {
  const palette = await createPalette("Mine", ["#ff0000"]);
  setDefaults({
    gridEnabled: false,
    gridSize: 8,
    checkerSize: 4,
    onionEnabled: true,
    onionDirection: "after",
    onionOpacity: 0.5,
    previewFps: 12,
    paletteId: palette.id,
  });
  const sprite = await createSprite({ width: 32, height: 32 });
  const screen = await openSprite(sprite.id);

  await expect.poll(() => useViewStore.getState().gridEnabled).toBe(false);
  expect(useViewStore.getState().gridSize).toBe(8);
  expect(useViewStore.getState().checkerSize).toBe(4);
  expect(useAnimationStore.getState().onion).toEqual({ enabled: true, direction: "after", opacity: 0.5 });
  expect(usePaletteStore.getState().activePaletteId).toBe(palette.id);
  await expect.element(screen.getByText("12 fps")).toBeVisible();
});

test("opening a sheet applies the defaults", async () => {
  setDefaults({ gridEnabled: false, gridSize: 8, checkerSize: 2 });
  const sheet = await createSpritesheet({ name: "Sheet", tileSize: 32 });
  const screen = await render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });

  await expect.element(screen.getByTestId("builder-canvas")).toBeInTheDocument();
  await expect.poll(() => useBuilderViewStore.getState().gridEnabled).toBe(false);
  expect(useBuilderViewStore.getState().gridSize).toBe(8);
  expect(useBuilderViewStore.getState().checkerSize).toBe(2);
});

test("in-session changes stay until the next open, which returns to the defaults", async () => {
  setDefaults({ gridEnabled: false });
  const first = await createSprite({ name: "First", width: 16, height: 16 });
  const second = await createSprite({ name: "Second", width: 16, height: 16 });

  const screen = await openSprite(first.id);
  await expect.poll(() => useViewStore.getState().gridEnabled).toBe(false);
  useViewStore.getState().setGridEnabled(true);
  expect(useViewStore.getState().gridEnabled).toBe(true);
  screen.unmount();

  await openSprite(second.id);
  await expect.poll(() => useViewStore.getState().gridEnabled).toBe(false);
});
