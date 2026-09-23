import { expect, test } from "vitest";
import { AppRoutes } from "@/app/routes";
import { createPalette, getPalette } from "@/db/repositories/palettes";
import { createSprite } from "@/db/repositories/sprites";
import {
  createSpritesheet,
  getSpritesheet,
  updateSpritesheet,
} from "@/db/repositories/spritesheets";
import { useEditorStore } from "@/stores/useEditorStore";
import { builderSaveSettled } from "@test/builder";
import { render } from "@test/render";

function fire(target: Element | Document, type: string, x: number, y: number, buttons: number) {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    }),
  );
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

/** Starts a drag from `source` and leaves the pointer held over `to`. */
async function holdDrag(source: Element, to: { x: number; y: number }) {
  const from = source.getBoundingClientRect();
  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;

  fire(source, "pointerdown", startX, startY, 1);
  await nextFrame();
  fire(document, "pointermove", startX + 8, startY + 8, 1);
  await nextFrame();
  fire(document, "pointermove", to.x, to.y, 1);
  await nextFrame();
  await nextFrame();
}

async function release(to: { x: number; y: number }) {
  fire(document, "pointerup", to.x, to.y, 0);
  await nextFrame();
}

async function openEditor() {
  const sprite = await createSprite({ width: 16, height: 16 });
  const screen = render(<AppRoutes />, { route: `/sprites/${sprite.id}` });
  await expect.element(screen.getByRole("application", { name: "Sprite canvas" })).toBeVisible();
  await expect.poll(() => useEditorStore.getState().containerSize.width > 0).toBe(true);
  return screen;
}

test("dragging a palette color shows a preview, rings the grid and opens an empty slot", async () => {
  // Every palette is a sortable drop zone now — this one just has predictable starting colors.
  const palette = await createPalette("Editable", ["#ff0000", "#00ff00", "#0000ff", "#ffff00"]);
  await openEditor();
  useEditorStore.getState().setActivePalette(palette.id);

  await expect
    .poll(
      () =>
        [...document.querySelectorAll('[data-drag-item="sortable"]')].filter((node) =>
          node.closest("[aria-label='Colors']"),
        ).length,
    )
    .toBe(4);

  const swatches = [...document.querySelectorAll('[data-drag-item="sortable"]')].filter(
    (node) => node.closest("[aria-label='Colors']"),
  );
  const source = swatches[0];
  const grid = source.parentElement!;
  const targetRect = swatches[3].getBoundingClientRect();
  const to = { x: targetRect.left + 2, y: targetRect.top + targetRect.height / 2 };

  await holdDrag(source, to);

  // 1. the dragged element itself follows the cursor, unrestyled but see-through
  expect(document.querySelector(".pointer-events-none.opacity-70")).toBeTruthy();

  // 2. the container the pointer is over rings itself in the primary color
  expect(grid.className).toContain("ring-primary");

  // 3. the source leaves an empty slot of its own size at the insertion point
  expect(source.className).toContain("opacity-0");
  expect(source.getBoundingClientRect().width).toBeGreaterThan(0);

  await release(to);

  // and the drag visuals are gone again once the drop animation has played out
  expect(grid.className).not.toContain("ring-primary");
  await expect.poll(() => document.querySelector(".pointer-events-none.opacity-70")).toBeNull();
});

/** The swatch's own color, read from its accessible name ("Color #rrggbbaa"). */
function swatchHex(node: Element): string | undefined {
  return node.querySelector("[aria-label^='Color #']")?.getAttribute("aria-label")?.slice(6, 13);
}

test("a reordered palette shows its new order before the write returns from Dexie", async () => {
  const palette = await createPalette("Editable", ["#ff0000", "#00ff00", "#0000ff", "#ffff00"]);
  await openEditor();
  useEditorStore.getState().setActivePalette(palette.id);

  const gridColors = () =>
    [...document.querySelectorAll('[data-drag-item="sortable"]')]
      .filter((node) => node.closest("[aria-label='Colors']"))
      .map((node) => swatchHex(node));

  await expect.poll(() => gridColors().length).toBe(4);
  expect(gridColors()).toEqual(["#ff0000", "#00ff00", "#0000ff", "#ffff00"]);

  const swatches = [...document.querySelectorAll('[data-drag-item="sortable"]')].filter(
    (node) => node.closest("[aria-label='Colors']"),
  );
  const lastRect = swatches[3].getBoundingClientRect();
  const to = { x: lastRect.right - 2, y: lastRect.top + lastRect.height / 2 };

  await holdDrag(swatches[0], to);
  fire(document, "pointerup", to.x, to.y, 0);
  // Only a microtask, which is long enough for React to flush the drop handler's state but far
  // too short for an IndexedDB write to round-trip — so seeing the new order here can only be
  // the optimistic one.
  await Promise.resolve();

  expect(gridColors()).toEqual(["#00ff00", "#0000ff", "#ffff00", "#ff0000"]);

  // …and the stored palette agrees once the write lands, so the optimistic order was not a lie.
  await expect
    .poll(async () => (await getPalette(palette.id))?.colors)
    .toEqual(["#00ff00", "#0000ff", "#ffff00", "#ff0000"]);
});

test("dragging a layer row opens an empty slot in the list", async () => {
  await openEditor();

  const row = document
    .querySelector("[aria-label='Layers']")!
    .querySelector('li[data-drag-item="sortable"]')!;
  const rect = row.getBoundingClientRect();

  const list = row.parentElement!;
  await holdDrag(row, { x: rect.left + rect.width / 2, y: rect.top + rect.height * 2 });

  expect(row.className).toContain("opacity-0");
  expect(row.getBoundingClientRect().height).toBeGreaterThan(0);
  // The preview is portalled outside the panel, and is the row itself — name and all.
  const preview = document.querySelector(".pointer-events-none.opacity-70");
  expect(preview?.textContent).toContain("Layer 1");
  // The list itself rings, even though it has no droppable of its own — only its rows do.
  expect(list.className).toContain("ring-primary");

  await release({ x: rect.left + rect.width / 2, y: rect.top + rect.height * 2 });
  expect(list.className).not.toContain("ring-primary");
  // The slot stays hollow while the preview animates back into it — filling it any earlier would
  // show the row twice — and fills again once the drop animation has landed.
  await expect.poll(() => row.className).not.toContain("opacity-0");
});

test("dragging a frame card rings the strip, even though only its cards are droppable", async () => {
  await openEditor();

  // The card is the strip's own <li>, so the <ol> is its parent.
  const card = document.querySelector('ol [data-drag-item="sortable"]')!;
  const strip = card.parentElement!;
  const rect = card.getBoundingClientRect();

  await holdDrag(card, { x: rect.right + rect.width, y: rect.top + rect.height / 2 });

  expect(strip.className).toContain("ring-primary");
  expect(card.className).toContain("opacity-0");

  await release({ x: rect.right + rect.width, y: rect.top + rect.height / 2 });
  expect(strip.className).not.toContain("ring-primary");
});

async function openComposerWithRow() {
  const hero = await createSprite({ name: "Hero", width: 8, height: 8 });
  const villain = await createSprite({ name: "Villain", width: 8, height: 8 });
  await createSprite({ name: "Mage", width: 8, height: 8 });
  const sheet = await createSpritesheet({ name: "Composed" });
  await updateSpritesheet(sheet.id, {
    blocks: [
      { id: "a", spriteId: hero.id, row: 0 },
      { id: "b", spriteId: villain.id, row: 0 },
    ],
  });
  render(<AppRoutes />, { route: `/spritesheets/${sheet.id}` });
  await expect
    .poll(() => document.querySelectorAll('[data-testid="builder-row"] [data-block-id]').length)
    .toBe(2);
  return sheet.id;
}

const rowBlockIds = () =>
  [...document.querySelectorAll('[data-testid="builder-row"] [data-block-id]')].map((node) =>
    node.getAttribute("data-block-id"),
  );

test("holding a sprite from the dock over a row opens a gap for it before the drop", async () => {
  const sheetId = await openComposerWithRow();
  const tile = document.querySelector('[aria-label="Drag Mage onto the sheet"]')!;
  const a = document.querySelector('[data-block-id="a"]')!.getBoundingClientRect();
  const bBefore = document.querySelector('[data-block-id="b"]')!.getBoundingClientRect();
  const dockTop = () => document.querySelector('[data-testid="builder-palette"]')!.getBoundingClientRect().top;
  const dockBefore = dockTop();
  // The right half of A: the stand-in should open between A and B.
  const to = { x: a.left + a.width * 0.75, y: a.top + a.height / 2 };

  await holdDrag(tile, to);

  // The page itself doesn't move when a drag starts: the overlay stays out of the layout.
  expect(dockTop()).toBe(dockBefore);

  const ids = rowBlockIds();
  expect(ids).toHaveLength(3);
  expect(ids[0]).toBe("a");
  expect(ids[2]).toBe("b");
  // B slides right by exactly one block's width to make room — the gap is real, not an overlay.
  // It animates there (the library transitions displaced items), so wait for it to settle.
  const bShift = () =>
    Math.round(document.querySelector('[data-block-id="b"]')!.getBoundingClientRect().left - bBefore.left);
  await expect.poll(bShift).toBe(Math.round(a.width));

  await release(to);

  await expect
    .poll(async () => (await getSpritesheet(sheetId)).blocks.map((block) => block.id))
    .toEqual(["a", ids[1], "b"]);
  await builderSaveSettled();
});

test("dragging a block along its row moves its hollow slot past its neighbour", async () => {
  const sheetId = await openComposerWithRow();
  const source = document.querySelector('[data-block-id="a"]')!;
  const b = document.querySelector('[data-block-id="b"]')!.getBoundingClientRect();
  const to = { x: b.left + b.width * 0.8, y: b.top + b.height / 2 };

  await holdDrag(source, to);

  expect(source.className).toContain("opacity-0");
  await expect.poll(rowBlockIds).toEqual(["b", "a"]);

  await release(to);
  await expect
    .poll(async () => (await getSpritesheet(sheetId)).blocks.map((block) => block.id))
    .toEqual(["b", "a"]);
  await builderSaveSettled();
});

test("a color dragged in from outside the palette opens a slot for itself before the drop", async () => {
  const palette = await createPalette("Editable", ["#ff0000", "#00ff00", "#0000ff"]);
  await openEditor();
  useEditorStore.getState().setActivePalette(palette.id);
  useEditorStore.getState().setPrimaryColor({ r: 0x12, g: 0x34, b: 0x56, a: 255 });

  const paletteSwatches = () =>
    [...document.querySelectorAll('[data-drag-item="sortable"]')].filter((node) =>
      node.closest("[aria-label='Colors']"),
    );
  await expect.poll(() => paletteSwatches().length).toBe(3);

  const primary = document.querySelector('[aria-label^="Primary color"]')!;
  const second = paletteSwatches()[1].getBoundingClientRect();
  const to = { x: second.left + second.width / 2, y: second.top + second.height / 2 };

  await holdDrag(primary, to);

  // A stand-in for the incoming color now sits where it will land, ahead of #00ff00.
  await expect.poll(() => paletteSwatches().length).toBe(4);
  const standIn = paletteSwatches()[1];
  expect(standIn.className).toContain("opacity-50");
  expect(swatchHex(standIn)).toBe("#123456");

  await release(to);

  await expect
    .poll(async () => (await getPalette(palette.id))?.colors)
    .toEqual(["#ff0000", "#123456", "#00ff00", "#0000ff"]);
});
