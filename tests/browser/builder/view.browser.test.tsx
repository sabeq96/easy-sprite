import { expect, test } from "vitest";
import { page, userEvent } from "@vitest/browser/context";
import { AppRoutes } from "@/app/routes";
import { BUILDER_ZOOM_LEVELS } from "@/constants/builder";
import { createSprite } from "@/db/repositories/sprites";
import { createSpritesheet, getSpritesheet, updateSpritesheet } from "@/db/repositories/spritesheets";
import type { SpritesheetBlockRecord } from "@/db/schema";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";
import { blocksSized, builderSaveSettled } from "@test/builder";
import { settled } from "@test/dom";
import { dragElementOnto } from "@test/pointer";
import { render } from "@test/render";

/** Renders the composer at a sheet of 8×8 sprites (placed per `blocks`) and waits for it. */
async function openSheet(
  names: string[],
  blocks: (ids: string[]) => SpritesheetBlockRecord[] = () => [],
  size = 8,
) {
  await page.viewport(1280, 720);
  const ids: string[] = [];
  for (const name of names) ids.push((await createSprite({ name, width: size, height: size })).id);
  const sheet = await createSpritesheet({ name: "Composed" });
  const placed = blocks(ids);
  await updateSpritesheet(sheet.id, { blocks: placed });

  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });
  await expect.element(screen.getByTestId("builder-trailing-row")).toBeVisible();
  await expect
    .poll(() => document.querySelectorAll('[data-testid="builder-canvas"] [data-block-id]').length)
    .toBe(placed.length);
  await blocksSized(sheet.id);
  return { screen, sheetId: sheet.id, ids };
}

const zoom = () => useBuilderViewStore.getState().zoom;
const blockWidth = (id: string) => document.querySelector(`[data-block-id="${id}"]`)!.getBoundingClientRect().width;
const blockIds = async (sheetId: string) => (await getSpritesheet(sheetId)).blocks.map((block) => block.id);
const SETTLE = { settleMoves: 2 };

function wheel(target: Element, deltaY: number, ctrlKey: boolean) {
  const rect = target.getBoundingClientRect();
  target.dispatchEvent(
    new WheelEvent("wheel", {
      deltaY,
      ctrlKey,
      clientX: rect.left + 10,
      clientY: rect.top + 10,
      bubbles: true,
      cancelable: true,
    }),
  );
}

test("zoom in/out walk the whole ladder, disable at its ends, and resize the blocks", async () => {
  const { screen } = await openSheet(["Hero"], ([hero]) => [{ id: "a", spriteId: hero, row: 0 }]);
  const zoomIn = screen.getByRole("button", { name: "Zoom in" });
  const zoomOut = screen.getByRole("button", { name: "Zoom out" });

  for (const level of BUILDER_ZOOM_LEVELS.slice(BUILDER_ZOOM_LEVELS.indexOf(4) + 1)) {
    await userEvent.click(zoomIn);
    await expect.element(screen.getByLabelText("Zoom level")).toHaveTextContent(`${level}×`);
    await expect.poll(() => blockWidth("a")).toBe(8 * level);
  }
  await expect.element(zoomIn).toBeDisabled();

  for (const level of [...BUILDER_ZOOM_LEVELS].reverse().slice(1)) {
    await userEvent.click(zoomOut);
    await expect.poll(() => blockWidth("a")).toBe(8 * level);
  }
  expect(zoom()).toBe(BUILDER_ZOOM_LEVELS[0]);
  await expect.element(zoomOut).toBeDisabled();
});

test("Ctrl/⌘+wheel zooms the sheet, while a plain wheel is left to scroll it", async () => {
  await openSheet(["Hero"], ([hero]) => [{ id: "a", spriteId: hero, row: 0 }]);
  const canvas = await settled(() => document.querySelector('[data-testid="builder-canvas"]'));

  wheel(canvas, -100, false);
  expect(zoom()).toBe(4);

  wheel(canvas, -100, true);
  expect(zoom()).toBe(6);
  wheel(canvas, 100, true);
  wheel(canvas, 100, true);
  expect(zoom()).toBe(3);
});

test("fit picks the largest zoom at which the whole sheet still fits the panel", async () => {
  // Two 64px sprites in a row: a 128×64 sheet.
  const { screen } = await openSheet(
    ["Hero", "Villain"],
    ([hero, villain]) => [
      { id: "a", spriteId: hero, row: 0 },
      { id: "b", spriteId: villain, row: 0 },
    ],
    64,
  );
  await expect.poll(() => useBuilderViewStore.getState().containerSize.width).toBeGreaterThan(0);

  await userEvent.click(screen.getByRole("button", { name: "Fit to window" }));

  const { width, height } = useBuilderViewStore.getState().containerSize;
  const level = zoom();
  expect(128 * level).toBeLessThanOrEqual(width);
  expect(64 * level).toBeLessThanOrEqual(height);
  const next = BUILDER_ZOOM_LEVELS[BUILDER_ZOOM_LEVELS.indexOf(level as 4) + 1];
  if (next) expect(128 * next > width || 64 * next > height).toBe(true);
  await expect.poll(() => blockWidth("a")).toBe(64 * level);
});

test("the grid switch hides the ruler and the cell size changes it", async () => {
  const { screen } = await openSheet(["Hero"]);

  await userEvent.click(screen.getByRole("button", { name: "Grid options" }));
  await userEvent.click(screen.getByRole("button", { name: "8px" }));
  expect(useBuilderViewStore.getState().gridCell).toBe(8);

  await userEvent.click(screen.getByRole("switch"));
  await expect.element(screen.getByTestId("builder-grid")).not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("button", { name: "Grid options" }))
    .toHaveAttribute("aria-pressed", "false");
});

test("searching the dock narrows it to matching sprites", async () => {
  const { screen } = await openSheet(["Hero", "Villain", "Heroine"]);
  const tile = (name: string) => screen.getByRole("button", { name: `Drag ${name} onto the sheet` });
  await expect.element(tile("Villain")).toBeVisible();

  await userEvent.type(screen.getByRole("textbox", { name: "Search sprites" }), "hero");

  await expect.element(tile("Villain")).not.toBeInTheDocument();
  await expect.element(tile("Hero")).toBeVisible();
  await expect.element(tile("Heroine")).toBeVisible();
});

test.each([2, 8])("at %i× zoom, a block dragged past its neighbour still trades places", async (level) => {
  const { sheetId } = await openSheet(["Hero", "Villain"], ([hero, villain]) => [
    { id: "a", spriteId: hero, row: 0 },
    { id: "b", spriteId: villain, row: 0 },
  ]);
  useBuilderViewStore.setState({ zoom: level });
  await expect.poll(() => blockWidth("a")).toBe(8 * level);

  const a = await settled(() => document.querySelector('[data-block-id="a"]'));
  const b = await settled(() => document.querySelector('[data-block-id="b"]'));
  // Aimed at the far quarter of B, in B's own screen size at this zoom.
  await dragElementOnto(a, b, { x: 8 * level * 0.8, y: 4 * level }, SETTLE);

  await expect.poll(() => blockIds(sheetId)).toEqual(["b", "a"]);
  await builderSaveSettled();
});

test.each([2, 8])("at %i× zoom, a sprite dropped on a block's left half lands before it", async (level) => {
  const { sheetId, ids } = await openSheet(["Hero", "Villain"], ([hero]) => [
    { id: "a", spriteId: hero, row: 0 },
  ]);
  useBuilderViewStore.setState({ zoom: level });
  await expect.poll(() => blockWidth("a")).toBe(8 * level);

  const tile = await settled(() => document.querySelector('[aria-label="Drag Villain onto the sheet"]'));
  const a = await settled(() => document.querySelector('[data-block-id="a"]'));
  await dragElementOnto(tile, a, { x: 8 * level * 0.2, y: 4 * level }, SETTLE);

  await expect
    .poll(async () => (await getSpritesheet(sheetId)).blocks.map((block) => block.spriteId))
    .toEqual([ids[1], ids[0]]);
  await builderSaveSettled();
});

test("zooming changes only the view, never the saved layout", async () => {
  const { screen, sheetId } = await openSheet(["Hero", "Villain"], ([hero, villain]) => [
    { id: "a", spriteId: hero, row: 0 },
    { id: "b", spriteId: villain, row: 1 },
  ]);
  const before = await getSpritesheet(sheetId);

  await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  await userEvent.click(screen.getByRole("button", { name: "Fit to window" }));

  expect((await getSpritesheet(sheetId)).blocks).toEqual(before.blocks);
});
