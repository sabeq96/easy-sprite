import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { AppRoutes } from "@/app/routes";
import { db } from "@/db/db";
import { createSprite, updateSprite } from "@/db/repositories/sprites";
import { createSpritesheet, getSpritesheet, updateSpritesheet } from "@/db/repositories/spritesheets";
import type { SpritesheetBlockRecord } from "@/db/schema";
import { packSheet, sizesFromRecords } from "@/export/spritesheetBuilderLayout";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";
import { render } from "@test/render";
import { builderSaveSettled } from "@test/builder";
import { dragElementOnto } from "@test/pointer";

/** An 8×8 one-frame sprite is a 32×32 block at the default 4× zoom. */
async function sheetWith(names: string[], blocks: (ids: string[]) => SpritesheetBlockRecord[] = () => []) {
  const sprites = [];
  for (const name of names) sprites.push(await createSprite({ name, width: 8, height: 8 }));
  const sheet = await createSpritesheet({ name: "Composed" });
  await updateSpritesheet(sheet.id, { blocks: blocks(sprites.map((sprite) => sprite.id)) });

  const screen = render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });
  await expect.element(screen.getByTestId("builder-trailing-row")).toBeVisible();
  return { screen, sheetId: sheet.id, spriteIds: sprites.map((sprite) => sprite.id) };
}

const blocksOf = async (sheetId: string) => (await getSpritesheet(sheetId)).blocks;
/** [spriteIndex, row] per block, in stored order — the sheet's whole layout at a glance. */
const layoutOf = async (sheetId: string, spriteIds: string[]) =>
  (await blocksOf(sheetId)).map((block) => [spriteIds.indexOf(block.spriteId), block.row]);

const tile = (name: string) => document.querySelector(`[aria-label="Drag ${name} onto the sheet"]`)!;
const block = (id: string) => document.querySelector(`[data-block-id="${id}"]`)!;
const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`)!;

/** Waits until every placed block has rendered, so the drag has real geometry to aim at. */
async function blocksRendered(count: number) {
  await expect
    .poll(() => document.querySelectorAll('[data-testid="builder-canvas"] [data-block-id]').length)
    .toBe(count);
}

test("a sprite dropped on the empty sheet becomes its first row", async () => {
  const { sheetId, spriteIds } = await sheetWith(["Hero"]);

  await dragElementOnto(tile("Hero"), byTestId("builder-trailing-row"), { x: 40, y: 40 });

  await expect.poll(() => layoutOf(sheetId, spriteIds)).toEqual([[0, 0]]);
  await builderSaveSettled();
});

test("a sprite dropped along a row's empty stretch joins the end of that row", async () => {
  const { sheetId, spriteIds } = await sheetWith(["Hero", "Villain"], ([hero]) => [
    { id: "a", spriteId: hero, row: 0 },
  ]);
  await blocksRendered(1);

  // Well right of Hero, at the row's vertical middle — clear of the gutters on its edges.
  await dragElementOnto(tile("Villain"), byTestId("builder-row"), { x: 120, y: 16 });

  await expect.poll(() => layoutOf(sheetId, spriteIds)).toEqual([
    [0, 0],
    [1, 0],
  ]);
  await builderSaveSettled();
});

test("a sprite dropped on the left half of a block lands before it, flush", async () => {
  const { sheetId, spriteIds } = await sheetWith(["Hero", "Villain"], ([hero]) => [
    { id: "a", spriteId: hero, row: 0 },
  ]);
  await blocksRendered(1);

  await dragElementOnto(tile("Villain"), block("a"), { x: 6, y: 16 });

  await expect.poll(() => layoutOf(sheetId, spriteIds)).toEqual([
    [1, 0],
    [0, 0],
  ]);
  await builderSaveSettled();
});

test("a sprite dropped on the gutter above the first row opens a new row there", async () => {
  const { sheetId, spriteIds } = await sheetWith(["Hero", "Villain"], ([hero]) => [
    { id: "a", spriteId: hero, row: 0 },
  ]);
  await blocksRendered(1);

  await dragElementOnto(tile("Villain"), byTestId("builder-gutter-0"), { x: 60, y: 4 });

  await expect.poll(() => layoutOf(sheetId, spriteIds)).toEqual([
    [1, 0],
    [0, 1],
  ]);
  await builderSaveSettled();
});

test("a block dragged past its neighbour trades places with it", async () => {
  const { sheetId } = await sheetWith(["Hero", "Villain"], ([hero, villain]) => [
    { id: "a", spriteId: hero, row: 0 },
    { id: "b", spriteId: villain, row: 0 },
  ]);
  await blocksRendered(2);

  await dragElementOnto(block("a"), block("b"), { x: 26, y: 16 });

  await expect.poll(async () => (await blocksOf(sheetId)).map((entry) => entry.id)).toEqual(["b", "a"]);
  // Moved, not re-created: the ids survive and both are still in row 0.
  expect((await blocksOf(sheetId)).map((entry) => entry.row)).toEqual([0, 0]);
  await builderSaveSettled();
});

test("a block dropped on the near half of its neighbour stays where it was", async () => {
  // One rule everywhere: before or after the block under the pointer, by which half it is in —
  // within a row too, not "swap as soon as the pointer enters the neighbour".
  const { sheetId } = await sheetWith(["Hero", "Villain"], ([hero, villain]) => [
    { id: "a", spriteId: hero, row: 0 },
    { id: "b", spriteId: villain, row: 0 },
  ]);
  await blocksRendered(2);

  await dragElementOnto(block("a"), block("b"), { x: 6, y: 16 }, { settleMoves: 2 });

  await new Promise((resolve) => setTimeout(resolve, 100));
  expect((await blocksOf(sheetId)).map((entry) => entry.id)).toEqual(["a", "b"]);
});

test("a block too small for its own chrome is still grabbed wherever it is pressed", async () => {
  const { sheetId } = await sheetWith(["Hero", "Villain"], ([hero, villain]) => [
    { id: "a", spriteId: hero, row: 0 },
    { id: "b", spriteId: villain, row: 0 },
  ]);
  await blocksRendered(2);
  // At 1× an 8×8 sprite is 8 screen px — smaller than the gutter strips on its edges.
  useBuilderViewStore.setState({ zoom: 1 });
  await expect.poll(() => block("a").getBoundingClientRect().width).toBe(8);

  // Press whatever is actually under the pointer at the block's centre, as a real press would.
  const rect = block("a").getBoundingClientRect();
  const pressed = document.elementFromPoint(rect.left + 4, rect.top + 4)!;
  expect(block("a").contains(pressed)).toBe(true);

  await dragElementOnto(pressed, block("b"), { x: 7, y: 4 }, { settleMoves: 2 });

  await expect.poll(async () => (await blocksOf(sheetId)).map((entry) => entry.id)).toEqual(["b", "a"]);
  await builderSaveSettled();
});

test("a block dragged into another row joins it, and the row it left collapses", async () => {
  const { sheetId } = await sheetWith(["Hero", "Villain", "Mage"], ([hero, villain, mage]) => [
    { id: "a", spriteId: hero, row: 0 },
    { id: "b", spriteId: villain, row: 1 },
    { id: "c", spriteId: mage, row: 2 },
  ]);
  await blocksRendered(3);

  await dragElementOnto(block("b"), block("a"), { x: 26, y: 16 });

  await expect
    .poll(async () => (await blocksOf(sheetId)).map((entry) => [entry.id, entry.row]))
    .toEqual([
      ["a", 0],
      ["b", 0],
      ["c", 1],
    ]);
  await builderSaveSettled();
});

test("a block alone in its row, dragged down into the next row, lands in that row", async () => {
  // Emptying the first row mid-drag must not slide the rows below up under the pointer — the
  // block would otherwise be carried one row further than it was aimed.
  const { sheetId } = await sheetWith(["Hero", "Villain", "Mage"], ([hero, villain, mage]) => [
    { id: "a", spriteId: hero, row: 0 },
    { id: "b", spriteId: villain, row: 1 },
    { id: "c", spriteId: mage, row: 2 },
  ]);
  await blocksRendered(3);

  await dragElementOnto(block("a"), block("b"), { x: 26, y: 16 }, { settleMoves: 3 });

  await expect
    .poll(async () => (await blocksOf(sheetId)).map((entry) => [entry.id, entry.row]))
    .toEqual([
      ["b", 0],
      ["a", 0],
      ["c", 1],
    ]);
  await builderSaveSettled();
});

test("a block dragged back onto the dock leaves the sheet and returns to the palette", async () => {
  const { sheetId } = await sheetWith(["Hero"], ([hero]) => [{ id: "a", spriteId: hero, row: 0 }]);
  await blocksRendered(1);

  await dragElementOnto(block("a"), byTestId("builder-palette"), { x: 300, y: 60 });

  await expect.poll(() => blocksOf(sheetId)).toEqual([]);
  await expect.poll(() => tile("Hero")).toBeTruthy();
  await builderSaveSettled();
});

test("a block released outside every target stays where it was", async () => {
  const { sheetId } = await sheetWith(["Hero"], ([hero]) => [{ id: "a", spriteId: hero, row: 0 }]);
  await blocksRendered(1);

  await dragElementOnto(block("a"), document.querySelector("header")!, { x: 300, y: 10 });

  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(await blocksOf(sheetId)).toEqual([{ id: "a", spriteId: expect.any(String), row: 0 }]);
});

test("removing the last block of a middle row pulls the rows below it up", async () => {
  const { screen, sheetId } = await sheetWith(["Hero", "Villain", "Mage"], ([hero, villain, mage]) => [
    { id: "a", spriteId: hero, row: 0 },
    { id: "b", spriteId: villain, row: 1 },
    { id: "c", spriteId: mage, row: 2 },
  ]);
  await blocksRendered(3);

  // An 8×8 sprite is a 32px block at 4× — too small to draw its ✕, which stays keyboard-reachable.
  (screen.getByRole("button", { name: "Remove Villain", exact: true }).element() as HTMLElement).focus();
  await userEvent.keyboard("{Enter}");

  await expect
    .poll(async () => (await blocksOf(sheetId)).map((entry) => [entry.id, entry.row]))
    .toEqual([
      ["a", 0],
      ["c", 1],
    ]);
  await builderSaveSettled();
});

test("what the sheet shows is exactly what packSheet exports", async () => {
  // Mixed sizes and frame counts across two rows: a 2-frame 16×8 strip, a tall 8×16, a small 8×8.
  const wide = await createSprite({ name: "Wide", width: 16, height: 8 });
  await updateSprite(wide.id, { frames: [{ id: "f1" }, { id: "f2" }] });
  const tall = await createSprite({ name: "Tall", width: 8, height: 16 });
  const small = await createSprite({ name: "Small", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Mixed" });
  await updateSpritesheet(sheet.id, {
    blocks: [
      { id: "w", spriteId: wide.id, row: 0 },
      { id: "t", spriteId: tall.id, row: 0 },
      { id: "s", spriteId: small.id, row: 1 },
    ],
  });

  render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });
  await blocksRendered(3);

  const packed = packSheet(await blocksOf(sheet.id), sizesFromRecords(await db.sprites.toArray()));
  const zoom = useBuilderViewStore.getState().zoom;
  const origin = byTestId("builder-canvas").getBoundingClientRect();

  expect(packed.blocks).toHaveLength(3);
  for (const entry of packed.blocks) {
    const rect = block(entry.id).getBoundingClientRect();
    expect({
      x: Math.round(rect.left - origin.left),
      y: Math.round(rect.top - origin.top),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    }).toEqual({ x: entry.x * zoom, y: entry.y * zoom, w: entry.w * zoom, h: entry.h * zoom });
  }
});
