import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { AppRoutes } from "@/app/routes";
import { createSprite } from "@/db/repositories/sprites";
import { createSpritesheet } from "@/db/repositories/spritesheets";
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
