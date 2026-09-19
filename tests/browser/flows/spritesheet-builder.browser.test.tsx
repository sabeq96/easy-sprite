import { expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { AppRoutes } from "@/app/routes";
import { createSprite } from "@/db/repositories/sprites";
import {
  createSpritesheet,
  getSpritesheet,
  updateSpritesheet,
} from "@/db/repositories/spritesheets";
import { render } from "@test/render";

test("creating a spritesheet from the library opens the composer, and it lists with a sheet badge", async () => {
  const screen = render(<AppRoutes />, { route: "/sprites" });

  // "New spritesheet" lives behind the create button's chevron, next to the main "New sprite".
  await userEvent.click(screen.getByRole("button", { name: "More ways to create" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "New spritesheet" }));
  await expect.element(screen.getByRole("dialog", { name: "New spritesheet" })).toBeVisible();

  await userEvent.fill(screen.getByLabelText("Name"), "Scene sheet");
  await userEvent.click(screen.getByRole("button", { name: "Create" }));

  await expect.element(screen.getByLabelText("Spritesheet name")).toHaveValue("Scene sheet");

  await userEvent.click(screen.getByRole("button", { name: "Back to sprites" }));
  await expect.element(screen.getByRole("button", { name: "Open Scene sheet" })).toBeVisible();
  await expect.element(screen.getByText("Sheet", { exact: true })).toBeVisible();
});

test("the composer header exposes export and a save indicator, like the sprite editor", async () => {
  const sheet = await createSpritesheet({ name: "Composed" });
  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });

  // Export is a button in both headers, never buried in a menu. The status dot is named by
  // its state; dnd-kit's own live region is also role="status", hence the explicit name.
  await expect.element(screen.getByRole("button", { name: "Export" })).toBeVisible();
  await expect.element(screen.getByRole("status", { name: "Saved" })).toBeVisible();

  await userEvent.fill(screen.getByLabelText("Spritesheet name"), "Renamed");
  await userEvent.keyboard("{Enter}");

  // The badge reports a real write, so the rename must land in the database behind it.
  await expect.poll(async () => (await getSpritesheet(sheet.id)).name).toBe("Renamed");
  await expect.element(screen.getByRole("status", { name: "Saved" })).toBeVisible();
});

test("the composer's palette lists project sprites to drag onto the canvas", async () => {
  await createSprite({ name: "Hero", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });

  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });

  await expect.element(screen.getByText("Hero")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Export" })).toBeVisible();
});

test("a sprite already on the sheet drops out of the palette until it is removed", async () => {
  const placed = await createSprite({ name: "Hero", width: 8, height: 8 });
  await createSprite({ name: "Villain", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });
  await updateSpritesheet(sheet.id, {
    blocks: [{ id: "block-1", spriteId: placed.id, x: 0, y: 0 }],
  });

  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });

  // A sheet packs each sprite once, so only the unplaced one is still offered.
  await expect
    .element(screen.getByRole("button", { name: "Drag Villain onto the sheet" }))
    .toBeVisible();
  await expect
    .element(screen.getByRole("button", { name: "Drag Hero onto the sheet" }))
    .not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Remove Hero", exact: true }), {
    force: true,
  });

  // Removing it from the canvas returns it to the palette.
  await expect
    .element(screen.getByRole("button", { name: "Drag Hero onto the sheet" }))
    .toBeVisible();
});

test("a persisted block renders on the canvas and can be removed", async () => {
  const sprite = await createSprite({ name: "Hero", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });
  await updateSpritesheet(sheet.id, {
    blocks: [{ id: "block-1", spriteId: sprite.id, x: 0, y: 0 }],
  });

  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });

  // Exact, because dnd-kit gives the draggable wrapper its own role="button" whose computed
  // name concatenates the nested remove button's label with the block's visible name.
  const removeButton = screen.getByRole("button", { name: "Remove Hero", exact: true });
  await expect.element(removeButton).toBeInTheDocument();

  await userEvent.click(removeButton, { force: true });
  await expect.element(removeButton).not.toBeInTheDocument();
});

test("exporting the composed sheet produces a PNG blob", async () => {
  const sprite = await createSprite({ name: "Hero", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });
  await updateSpritesheet(sheet.id, {
    blocks: [{ id: "block-1", spriteId: sprite.id, x: 0, y: 0 }],
  });

  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });

  await userEvent.click(screen.getByRole("button", { name: "Export" }));
  await expect.element(screen.getByRole("dialog", { name: "Export spritesheet" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Export PNG" }));

  await expect.poll(() => createObjectURL.mock.calls.length).toBe(1);
  const [blob] = createObjectURL.mock.calls[0] as [Blob];
  expect(blob.type).toBe("image/png");
  expect(blob.size).toBeGreaterThan(0);

  createObjectURL.mockRestore();
});
