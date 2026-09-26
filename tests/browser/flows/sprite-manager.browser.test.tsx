import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { AppRoutes } from "@/app/routes";
import { createSprite, listSprites } from "@/db/repositories/sprites";
import { createSpritesheet, listSpritesheets } from "@/db/repositories/spritesheets";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";
import { useEditorStore } from "@/stores/useEditorStore";
import { render } from "@test/render";

test("creating a sprite from the library opens it in the editor, and it lists on the way back", async () => {
  const screen = render(<AppRoutes />, { route: "/sprites" });

  // The empty state and the toolbar both offer a "New sprite" button. Exact, because the
  // toolbar also has a "New spritesheet" button whose name contains "New sprite" as a substring.
  await userEvent.click(screen.getByRole("button", { name: "New sprite", exact: true }).first());
  await expect.element(screen.getByRole("dialog", { name: "New sprite" })).toBeVisible();

  await userEvent.fill(screen.getByLabelText("Name"), "Hero walk");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));

  await expect.element(screen.getByRole("application", { name: "Sprite canvas" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Back to sprites" }));
  await expect.element(screen.getByRole("button", { name: "Open Hero walk" })).toBeVisible();
});

test("a new sprite is sized in tiles, and opens with a one-tile grid and a 1px chessboard", async () => {
  const screen = render(<AppRoutes />, { route: "/sprites" });

  await userEvent.click(screen.getByRole("button", { name: "New sprite", exact: true }).first());
  await userEvent.click(screen.getByRole("button", { name: "24×24" }));
  await userEvent.fill(screen.getByLabelText("Columns"), "3");
  await userEvent.fill(screen.getByLabelText("Rows"), "2");
  await expect.element(screen.getByText("72×48 px")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Create" }));

  await expect.element(screen.getByRole("application", { name: "Sprite canvas" })).toBeVisible();
  const [sprite] = await listSprites();
  expect([sprite.width, sprite.height, sprite.tileSize]).toEqual([72, 48, 24]);
  await expect.poll(() => useEditorStore.getState().gridSize).toBe(24);
  expect(useEditorStore.getState().checkerSize).toBe(1);
});

test("a bigger tile pulls the column and row counts back under the canvas limit", async () => {
  const screen = render(<AppRoutes />, { route: "/sprites" });

  await userEvent.click(screen.getByRole("button", { name: "New sprite", exact: true }).first());
  await userEvent.fill(screen.getByLabelText("Columns"), "20");
  await userEvent.click(screen.getByRole("button", { name: "64×64" }));
  // 512 / 64 = 8 tiles at most.
  await expect.element(screen.getByLabelText("Columns")).toHaveValue(8);
  await expect.element(screen.getByText("512×128 px")).toBeVisible();
});

test("a new spritesheet keeps its tile size and opens with a one-tile grid", async () => {
  const screen = render(<AppRoutes />, { route: "/sprites" });

  await userEvent.click(screen.getByRole("button", { name: "More ways to create" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "New spritesheet" }));
  await userEvent.click(screen.getByRole("button", { name: "32×32" }));
  await userEvent.click(screen.getByRole("button", { name: "Create" }));

  await expect.element(screen.getByTestId("builder-canvas")).toBeInTheDocument();
  const [sheet] = await listSpritesheets();
  expect(sheet.tileSize).toBe(32);
  await expect.poll(() => useBuilderViewStore.getState().gridSize).toBe(32);
  expect(useBuilderViewStore.getState().checkerSize).toBe(1);
});

test("tags entered when creating a sprite show up in the library", async () => {
  const screen = render(<AppRoutes />, { route: "/sprites" });

  await userEvent.click(screen.getByRole("button", { name: "New sprite", exact: true }).first());
  await userEvent.fill(screen.getByLabelText("Name"), "Hero walk");
  await userEvent.fill(screen.getByLabelText("Tags"), "Hero, Walk");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));
  await expect.element(screen.getByRole("application", { name: "Sprite canvas" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Back to sprites" }));
  await expect.element(screen.getByRole("button", { name: "hero 1", exact: true })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "walk 1", exact: true })).toBeVisible();
});

test("deleting a sprite through its menu removes it from the library", async () => {
  const screen = render(<AppRoutes />, { route: "/sprites" });

  await userEvent.click(screen.getByRole("button", { name: "New sprite", exact: true }).first());
  await userEvent.fill(screen.getByLabelText("Name"), "Throwaway");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));
  await expect.element(screen.getByRole("application", { name: "Sprite canvas" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Back to sprites" }));
  await expect.element(screen.getByRole("button", { name: "Open Throwaway" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Actions for Throwaway" }));
  // The delete row is an AlertDialogTrigger wrapping the menu item (so the confirm can nest
  // inside it), which gives it role="button" rather than the menu's own "menuitem" role.
  await userEvent.click(screen.getByRole("button", { name: "Delete", exact: true }).first());
  await userEvent.click(screen.getByRole("button", { name: "Delete", exact: true }).last());

  await expect.element(screen.getByRole("button", { name: "Open Throwaway" })).not.toBeInTheDocument();
});

test("renaming a sprite from its menu updates the card and its tags", async () => {
  await createSprite({ name: "Draft", width: 8, height: 8 });
  const screen = render(<AppRoutes />, { route: "/sprites" });

  await userEvent.click(screen.getByRole("button", { name: "Actions for Draft" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));

  await expect.element(screen.getByRole("dialog", { name: "Rename sprite" })).toBeVisible();
  // Exact: the dialog's own name, "Rename sprite", contains "name" as a substring.
  await userEvent.fill(screen.getByLabelText("Name", { exact: true }), "Hero walk");
  await userEvent.fill(screen.getByLabelText("Tags"), "Hero, Walk");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));

  await expect.element(screen.getByRole("button", { name: "Open Hero walk" })).toBeVisible();
  // Tags are normalised to lowercase and become filter chips in the toolbar, each showing
  // how many library items carry it.
  await expect.element(screen.getByRole("button", { name: "hero 1", exact: true })).toBeVisible();
});

test("splitting a sprite from its menu replaces its frames with a grid", async () => {
  await createSprite({ name: "Sheet", width: 4, height: 2 });
  const screen = render(<AppRoutes />, { route: "/sprites" });

  await userEvent.click(screen.getByRole("button", { name: "Actions for Sheet" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Split into frames" }));

  await expect
    .element(screen.getByRole("dialog", { name: 'Split "Sheet" into frames' }))
    .toBeVisible();

  await userEvent.fill(screen.getByLabelText("Frame width"), "2");
  await userEvent.fill(screen.getByLabelText("Frame height"), "2");
  await expect.element(screen.getByText("2×1 grid → 2 frames")).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Split" }));

  await expect.element(screen.getByRole("button", { name: "Open Sheet" })).toBeVisible();
  await expect.element(screen.getByText("2×2 · 2 frames")).toBeVisible();
});

test("the create menu offers a way to import PNGs", async () => {
  const screen = render(<AppRoutes />, { route: "/sprites" });

  await userEvent.click(screen.getByRole("button", { name: "More ways to create" }));
  await expect.element(screen.getByRole("menuitem", { name: "Import PNG" })).toBeVisible();
});

test("spritesheets rename through the same dialog as sprites", async () => {
  await createSpritesheet({ name: "Sheet draft" });
  const screen = render(<AppRoutes />, { route: "/sprites" });

  await userEvent.click(screen.getByRole("button", { name: "Actions for Sheet draft" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));

  await expect.element(screen.getByRole("dialog", { name: "Rename spritesheet" })).toBeVisible();
  await userEvent.fill(screen.getByLabelText("Name", { exact: true }), "Enemies");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));

  await expect.element(screen.getByRole("button", { name: "Open Enemies" })).toBeVisible();
});

test("reopening the new-sprite dialog after Cancel starts from an empty draft", async () => {
  const screen = render(<AppRoutes />, { route: "/sprites" });
  const openDialog = () =>
    userEvent.click(screen.getByRole("button", { name: "New sprite", exact: true }).first());

  await openDialog();
  await userEvent.fill(screen.getByLabelText("Name"), "Abandoned");
  await userEvent.fill(screen.getByLabelText("Tags"), "draft");
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();

  await openDialog();
  await expect.element(screen.getByLabelText("Name")).toHaveValue("");
  await expect.element(screen.getByLabelText("Tags")).toHaveValue("");
});
