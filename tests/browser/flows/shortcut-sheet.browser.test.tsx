import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { AppRoutes } from "@/app/routes";
import { createSprite } from "@/db/repositories/sprites";
import { createSpritesheet } from "@/db/repositories/spritesheets";
import { openEditor } from "@test/editor";
import { render } from "@test/render";

/** Each section's heading, then its rows' labels, in the order the sheet shows them. */
async function sheetOutline() {
  await userEvent.keyboard("?");
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect.element(dialog).toBeVisible();
  return [...dialog.element().querySelectorAll("section")].map((section) => [
    section.querySelector("h3")?.textContent,
    ...[...section.querySelectorAll("li > span")].map((label) => label.textContent),
  ]);
}

test("the editor's sheet lists its groups and rows in a fixed order", async () => {
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
      "Toggle pixel grid",
      "Toggle onion skin",
      "Zoom",
      "Pan",
      "Pan",
      "Pan",
    ],
    ["App", "Keyboard shortcuts", "Back to sprites"],
  ]);
});

test("the composer's sheet lists its groups and rows in a fixed order", async () => {
  await page.viewport(1280, 720);
  await createSprite({ name: "Hero", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });
  const screen = await render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });
  await expect.element(screen.getByTestId("builder-trailing-row")).toBeVisible();

  expect(await sheetOutline()).toEqual([
    ["Edit", "Undo", "Redo", "Save now"],
    ["View", "Zoom in", "Zoom out", "Fit to window", "Toggle grid", "Zoom"],
    ["App", "Keyboard shortcuts", "Back to sprites"],
  ]);
});
