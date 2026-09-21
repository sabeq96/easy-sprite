import { expect, test } from "vitest";
import { AppRoutes } from "@/app/routes";
import { createPalette, getPalette } from "@/db/repositories/palettes";
import { createSprite } from "@/db/repositories/sprites";
import { useEditorStore } from "@/stores/useEditorStore";
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
        [...document.querySelectorAll('[aria-roledescription="sortable"]')].filter((node) =>
          node.closest("[aria-label='Colors']"),
        ).length,
    )
    .toBe(4);

  const swatches = [...document.querySelectorAll('[aria-roledescription="sortable"]')].filter(
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

test("a reordered palette shows its new order before the write returns from Dexie", async () => {
  const palette = await createPalette("Editable", ["#ff0000", "#00ff00", "#0000ff", "#ffff00"]);
  await openEditor();
  useEditorStore.getState().setActivePalette(palette.id);

  const gridColors = () =>
    [...document.querySelectorAll('[aria-roledescription="sortable"]')]
      .filter((node) => node.closest("[aria-label='Colors']"))
      .map((node) => node.getAttribute("title")?.slice(0, 7));

  await expect.poll(() => gridColors().length).toBe(4);
  expect(gridColors()).toEqual(["#ff0000", "#00ff00", "#0000ff", "#ffff00"]);

  const swatches = [...document.querySelectorAll('[aria-roledescription="sortable"]')].filter(
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
    .querySelector('li[aria-roledescription="sortable"]')!;
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
  expect(row.className).not.toContain("opacity-0");
  expect(list.className).not.toContain("ring-primary");
});

test("dragging a frame card rings the strip, even though only its cards are droppable", async () => {
  await openEditor();

  // FrameCard sits inside an <li>, which sits inside the strip's <ol> — two levels up.
  const card = document.querySelector('ol [aria-roledescription="sortable"]')!;
  const strip = card.parentElement!.parentElement!;
  const rect = card.getBoundingClientRect();

  await holdDrag(card, { x: rect.right + rect.width, y: rect.top + rect.height / 2 });

  expect(strip.className).toContain("ring-primary");
  expect(card.className).toContain("opacity-0");

  await release({ x: rect.right + rect.width, y: rect.top + rect.height / 2 });
  expect(strip.className).not.toContain("ring-primary");
});
