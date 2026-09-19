import { expect, test } from "vitest";
import { AppRoutes } from "@/app/routes";
import { BUILDER_GRID_SIZE, BUILDER_ZOOM } from "@/constants/builder";
import { createSprite } from "@/db/repositories/sprites";
import { createSpritesheet, getSpritesheet, updateSpritesheet } from "@/db/repositories/spritesheets";
import { render } from "@test/render";
import { dragElementOnto } from "@test/pointer";

/** An 8×8 one-frame sprite occupies an 8×8 block, which is one BUILDER_GRID_SIZE cell. */
async function openComposer(name = "Hero") {
  const sprite = await createSprite({ name, width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });
  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });

  const palette = screen.getByRole("button", { name: `Drag ${name} onto the sheet` });
  await expect.element(palette).toBeVisible();

  return { screen, sheet, sprite, palette, canvas: screen.getByTestId("builder-canvas") };
}

function blocksOf(sheetId: string) {
  return getSpritesheet(sheetId).then((sheet) => sheet.blocks);
}

test("dragging a sprite from the palette onto the canvas places it where it was dropped", async () => {
  const { sheet, palette, canvas } = await openComposer();

  // 64px / 4× zoom = sprite pixel 16; 32px / 4× = sprite pixel 8. Both already on the grid.
  await dragElementOnto(palette.element(), canvas.element(), { x: 16 * BUILDER_ZOOM, y: 8 * BUILDER_ZOOM });

  await expect.poll(async () => (await blocksOf(sheet.id)).length).toBe(1);
  const [block] = await blocksOf(sheet.id);
  expect({ x: block.x, y: block.y }).toEqual({ x: 16, y: 8 });
});

test("a drop lands on the grid, not between cells", async () => {
  const { sheet, palette, canvas } = await openComposer();

  // Deliberately off-grid: 3 sprite pixels in, which must snap back to 0.
  await dragElementOnto(palette.element(), canvas.element(), { x: 3 * BUILDER_ZOOM, y: 3 * BUILDER_ZOOM });

  await expect.poll(async () => (await blocksOf(sheet.id)).length).toBe(1);
  const [block] = await blocksOf(sheet.id);
  // Exactly 0,0 — and deliberately a different answer than the test above, so neither could be
  // passing on a hardcoded or ignored drop position.
  expect({ x: block.x, y: block.y }).toEqual({ x: 0, y: 0 });
});

test("dropping a sprite onto an occupied cell is rejected", async () => {
  const sprite = await createSprite({ name: "Hero", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });
  await updateSpritesheet(sheet.id, {
    blocks: [{ id: "block-1", spriteId: sprite.id, x: 0, y: 0 }],
  });

  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });
  // The placed block's document must have loaded before its footprint can be collided against.
  await expect
    .element(screen.getByRole("button", { name: "Remove Hero", exact: true }))
    .toBeInTheDocument();

  const palette = screen.getByRole("button", { name: "Drag Hero onto the sheet" });
  await dragElementOnto(palette.element(), screen.getByTestId("builder-canvas").element(), {
    x: 0,
    y: 0,
  });

  // Still just the original block — the overlapping drop placed nothing.
  await expect.poll(async () => (await blocksOf(sheet.id)).length).toBe(1);
  expect((await blocksOf(sheet.id))[0].id).toBe("block-1");
});

test("dropping outside the canvas places nothing", async () => {
  const { sheet, palette } = await openComposer();

  // Released back over the palette dock rather than the sheet.
  await dragElementOnto(palette.element(), palette.element(), { x: 4, y: 4 });

  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(await blocksOf(sheet.id)).toHaveLength(0);
});

test("a placed block can be dragged to a new position on the canvas", async () => {
  const sprite = await createSprite({ name: "Hero", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });
  await updateSpritesheet(sheet.id, {
    blocks: [{ id: "block-1", spriteId: sprite.id, x: 0, y: 0 }],
  });

  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });
  const remove = screen.getByRole("button", { name: "Remove Hero", exact: true });
  await expect.element(remove).toBeInTheDocument();

  const block = screen.getByRole("button", { name: "Remove Hero Hero" });
  await dragElementOnto(block.element(), screen.getByTestId("builder-canvas").element(), {
    x: 32 * BUILDER_ZOOM,
    y: 24 * BUILDER_ZOOM,
  });

  await expect.poll(async () => (await blocksOf(sheet.id))[0].x).toBeGreaterThan(0);
  const [moved] = await blocksOf(sheet.id);
  expect(await blocksOf(sheet.id)).toHaveLength(1);
  expect(moved.id).toBe("block-1"); // moved, not replaced by a new block
  expect(moved.x % BUILDER_GRID_SIZE).toBe(0);
  expect(moved.y % BUILDER_GRID_SIZE).toBe(0);
});
