import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { AppRoutes } from "@/app/routes";
import { createSprite } from "@/db/repositories/sprites";
import { createSpritesheet } from "@/db/repositories/spritesheets";
import { openEditor } from "@test/editor";
import { render } from "@test/render";

/** Each section's heading, then its rows' labels, in the order Keyboard shortcuts shows them. */
async function sheetOutline() {
  await userEvent.keyboard("?");
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect.element(dialog).toBeVisible();
  return [...dialog.element().querySelectorAll("section")].map((section) => [
    section.querySelector("h3")?.textContent,
    ...[...section.querySelectorAll("li > span")].map((label) => label.textContent),
  ]);
}

test("the editor's Keyboard shortcuts lists its groups and rows in a fixed order", async () => {
  await openEditor();

  expect(await sheetOutline()).toEqual([
    [
      "Tools",
      "Pencil",
      "Cycle brush size",
      "Eraser",
      "Cycle brush size",
      "Paint bucket",
      "Fill similar",
      "Color picker",
      "Select & move",
      "Mirror horizontally",
      "Use a tool until you let go",
    ],
    [
      "Select & move",
      "Select all",
      "Deselect",
      "Copy",
      "Cut",
      "Paste",
      "Delete selection",
      "Duplicate selection · inside selection",
    ],
    ["Edit", "Undo", "Redo", "Save now"],
    [
      "Color",
      "Swap colors",
      "Reset colors",
      "Pick primary",
      "Pick secondary",
      "Paint with secondary color",
    ],
    [
      "Frames",
      "New frame",
      "Duplicate frame",
      "Previous frame",
      "Next frame",
      "Move frame left",
      "Move frame right",
    ],
    ["Layers", "New layer", "Merge layer down", "Select layer above", "Select layer below"],
    [
      "View",
      "Zoom in",
      "Zoom out",
      "Fit to window",
      "Toggle grid",
      "Toggle onion skin",
      "Zoom",
      "Pan",
      "Pan",
      "Pan",
    ],
    ["App", "Keyboard shortcuts", "Back to library"],
  ]);
});

test("the Builder's Keyboard shortcuts lists its groups and rows in a fixed order", async () => {
  await page.viewport(1280, 720);
  await createSprite({ name: "Hero", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });
  const screen = await render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });
  await expect.element(screen.getByTestId("builder-trailing-row")).toBeVisible();

  expect(await sheetOutline()).toEqual([
    ["Edit", "Undo", "Redo", "Save now"],
    ["View", "Zoom in", "Zoom out", "Fit to window", "Toggle grid", "Zoom"],
    ["App", "Keyboard shortcuts", "Back to library"],
  ]);
  await expect
    .element(page.getByRole("dialog", { name: "Keyboard shortcuts" }))
    .toHaveAccessibleDescription("Every key and gesture the builder understands.");
});

test("the editor and the builder list the same Toggle grid label", async () => {
  /** The View rows that name the grid. */
  const gridRows = async () =>
    (await sheetOutline()).find(([heading]) => heading === "View")?.filter((label) => /grid/i.test(label ?? ""));

  const editor = await openEditor();
  const editorRows = await gridRows();
  await editor.screen.unmount();

  await createSprite({ name: "Hero", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });
  const screen = await render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });
  await expect.element(screen.getByTestId("builder-trailing-row")).toBeVisible();

  expect(editorRows).toEqual(["Toggle grid"]);
  expect(await gridRows()).toEqual(editorRows);
});
