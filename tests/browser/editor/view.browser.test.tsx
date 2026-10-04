import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ZOOM_LEVELS } from "@/constants/canvas";
import { screenToSprite, spriteToScreen, type Point } from "@/core/viewport";
import { useViewStore } from "@/editor/view/api";
import { formatModifier } from "@/lib/keys";
import { KEYS, mod, openEditor, paintedPixels, session, type Editor } from "@test/editor";
import { dragClientPoints } from "@test/pointer";

/** Big enough to fit mid-ladder in the test viewport, so zoom can step both ways from the fit. */
const SPRITE = { width: 64, height: 64 };

const viewport = () => useViewStore.getState().viewport;

/** Where sprite pixel `point`'s centre sits on screen right now, in client coordinates. */
function clientOf(editor: Editor, point: Point) {
  const box = editor.canvas.getBoundingClientRect();
  const screen = spriteToScreen(viewport(), { x: point.x + 0.5, y: point.y + 0.5 });
  return { x: box.left + screen.x, y: box.top + screen.y };
}

/** The sprite pixel under a client point right now. */
function pixelUnder(editor: Editor, client: { x: number; y: number }) {
  const box = editor.canvas.getBoundingClientRect();
  return screenToSprite(viewport(), { x: client.x - box.left, y: client.y - box.top });
}

/** A Ctrl+wheel — how both a ⌘/Ctrl mouse wheel and a trackpad pinch arrive. */
function wheel(editor: Editor, client: { x: number; y: number }, deltaY: number) {
  editor.canvas.dispatchEvent(
    new WheelEvent("wheel", {
      deltaY,
      ctrlKey: true,
      clientX: client.x,
      clientY: client.y,
      bubbles: true,
      cancelable: true,
    }),
  );
}

/** A plain wheel or two-finger scroll. */
function scroll(editor: Editor, client: { x: number; y: number }, deltaX: number, deltaY: number) {
  editor.canvas.dispatchEvent(
    new WheelEvent("wheel", {
      deltaX,
      deltaY,
      clientX: client.x,
      clientY: client.y,
      bubbles: true,
      cancelable: true,
    }),
  );
}

const ladderIndex = (scale: number) => ZOOM_LEVELS.indexOf(scale as (typeof ZOOM_LEVELS)[number]);

/** Zooms in with the + key until the sprite is at least twice the view on both axes, so it can pan freely. */
async function zoomUntilOverflowing() {
  const { width, height } = useViewStore.getState().containerSize;
  const target = 2 * Math.max(width, height);
  while (SPRITE.width * viewport().scale < target && viewport().scale < ZOOM_LEVELS.at(-1)!) {
    await userEvent.keyboard("+");
  }
}

test("Ctrl/⌘+wheel and pinch zoom smoothly, between ladder steps", async () => {
  const editor = await openEditor(SPRITE);
  const start = viewport().scale;
  const centre = clientOf(editor, { x: 8, y: 8 });

  wheel(editor, centre, -10);
  const zoomedIn = viewport().scale;
  expect(zoomedIn).toBeGreaterThan(start);
  expect(ladderIndex(zoomedIn)).toBe(-1);

  wheel(editor, centre, 10);
  wheel(editor, centre, 10);
  expect(viewport().scale).toBeLessThan(start);
});

test("Ctrl/⌘+wheel zoom keeps the pixel under the cursor under the cursor", async () => {
  const editor = await openEditor(SPRITE);
  await zoomUntilOverflowing();
  const cursor = clientOf(editor, { x: 30, y: 33 });

  for (let i = 0; i < 5; i++) wheel(editor, cursor, -10);
  expect(pixelUnder(editor, cursor)).toEqual({ x: 30, y: 33 });

  for (let i = 0; i < 5; i++) wheel(editor, cursor, 10);
  expect(pixelUnder(editor, cursor)).toEqual({ x: 30, y: 33 });
});

test("after zooming in on a pixel, a click at that same screen spot paints that pixel", async () => {
  const editor = await openEditor(SPRITE);
  await zoomUntilOverflowing();
  const cursor = clientOf(editor, { x: 30, y: 30 });

  wheel(editor, cursor, -100);
  wheel(editor, cursor, -100);
  // Press at the very screen point the zoom was anchored on — not a recomputed one.
  dragClientPoints(editor.canvas, [cursor]);

  expect(paintedPixels()).toEqual(["30,30"]);
});

test("zoom buttons and the +, - and 0 keys all step the zoom, and 0 fits again", async () => {
  const editor = await openEditor(SPRITE);
  const fitted = viewport().scale;

  await userEvent.click(editor.screen.getByRole("button", { name: "Zoom in" }));
  expect(ladderIndex(viewport().scale)).toBe(ladderIndex(fitted) + 1);
  await userEvent.click(editor.screen.getByRole("button", { name: "Zoom out" }));
  await userEvent.click(editor.screen.getByRole("button", { name: "Zoom out" }));
  expect(ladderIndex(viewport().scale)).toBe(ladderIndex(fitted) - 1);

  await userEvent.keyboard("+");
  await userEvent.keyboard("=");
  expect(ladderIndex(viewport().scale)).toBe(ladderIndex(fitted) + 1);
  await userEvent.keyboard("-");
  expect(viewport().scale).toBe(fitted);

  await userEvent.keyboard("++");
  await userEvent.keyboard("0");
  expect(viewport().scale).toBe(fitted);
  await userEvent.click(editor.screen.getByRole("button", { name: "Fit to window" }));
  expect(viewport().scale).toBe(fitted);
});

test("from a zoom between ladder steps, + and - go to the next step up or down", async () => {
  const editor = await openEditor(SPRITE);
  const fitted = viewport().scale;
  const centre = clientOf(editor, { x: 8, y: 8 });

  wheel(editor, centre, -10);
  await userEvent.keyboard("+");
  expect(viewport().scale).toBe(ZOOM_LEVELS[ladderIndex(fitted) + 1]);

  wheel(editor, centre, -10);
  await userEvent.keyboard("-");
  expect(viewport().scale).toBe(ZOOM_LEVELS[ladderIndex(fitted) + 1]);

  wheel(editor, centre, -10);
  await userEvent.keyboard("0");
  expect(viewport().scale).toBe(fitted);
});

test("zoom stops at the ends of the ladder", async () => {
  const editor = await openEditor(SPRITE);
  const centre = clientOf(editor, { x: 8, y: 8 });

  for (let i = 0; i < 40; i++) wheel(editor, centre, -1000);
  expect(viewport().scale).toBe(ZOOM_LEVELS.at(-1));

  for (let i = 0; i < 40; i++) wheel(editor, centre, 1000);
  expect(viewport().scale).toBe(ZOOM_LEVELS[0]);
});

test("a sprite that fits stays centred: scrolling and dragging don't move it", async () => {
  const editor = await openEditor(SPRITE);
  const fitted = viewport();
  const from = clientOf(editor, { x: 8, y: 8 });

  scroll(editor, from, 40, -60);
  dragClientPoints(editor.canvas, [from, { x: from.x + 30, y: from.y - 20 }], { button: 1 });
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " " }));
  dragClientPoints(editor.canvas, [from, { x: from.x - 40, y: from.y + 10 }]);
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", key: " " }));

  expect(viewport()).toEqual(fitted);
  expect(paintedPixels()).toEqual([]);
});

test("a plain wheel pans an overflowing sprite and leaves the zoom alone", async () => {
  const editor = await openEditor(SPRITE);
  await zoomUntilOverflowing();
  const before = viewport();

  scroll(editor, clientOf(editor, { x: 30, y: 30 }), 30, -20);

  expect(viewport()).toEqual({
    scale: before.scale,
    originX: before.originX - 30,
    originY: before.originY + 20,
  });
  expect(paintedPixels()).toEqual([]);
});

test("a middle-drag pans an overflowing sprite by exactly the distance dragged, painting nothing", async () => {
  const editor = await openEditor(SPRITE);
  await zoomUntilOverflowing();
  const before = viewport();
  const from = clientOf(editor, { x: 30, y: 30 });

  dragClientPoints(editor.canvas, [from, { x: from.x + 30, y: from.y - 20 }], { button: 1 });

  expect(viewport().originX).toBe(before.originX + 30);
  expect(viewport().originY).toBe(before.originY - 20);
  expect(paintedPixels()).toEqual([]);
});

test("holding Space turns a left-drag into a pan", async () => {
  const editor = await openEditor(SPRITE);
  await zoomUntilOverflowing();
  const before = viewport();
  const from = clientOf(editor, { x: 30, y: 30 });

  window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " " }));
  dragClientPoints(editor.canvas, [from, { x: from.x - 40, y: from.y + 10 }]);
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", key: " " }));

  expect(viewport().originX).toBe(before.originX - 40);
  expect(viewport().originY).toBe(before.originY + 10);
  expect(paintedPixels()).toEqual([]);
});

test("after panning, a click still paints the pixel under the pointer", async () => {
  const editor = await openEditor(SPRITE);
  await zoomUntilOverflowing();
  const from = clientOf(editor, { x: 30, y: 30 });
  dragClientPoints(editor.canvas, [from, { x: from.x + 25, y: from.y + 35 }], { button: 1 });

  // The pixel that is now at the old spot is a different one — the pan moved the sprite.
  const target = pixelUnder(editor, from);
  expect(target).not.toEqual({ x: 30, y: 30 });
  dragClientPoints(editor.canvas, [from]);

  expect(paintedPixels()).toEqual([`${target.x},${target.y}`]);
});

test("an overflowing sprite pans only until 24px show past its edge", async () => {
  const editor = await openEditor(SPRITE);
  await zoomUntilOverflowing();
  const from = clientOf(editor, { x: 30, y: 30 });
  const { width, height } = useViewStore.getState().containerSize;

  dragClientPoints(editor.canvas, [from, { x: from.x + 9000, y: from.y + 9000 }], { button: 1 });
  expect(viewport().originX).toBe(24);
  expect(viewport().originY).toBe(24);

  scroll(editor, from, 90_000, 90_000);
  const size = SPRITE.width * viewport().scale;
  expect(viewport().originX).toBe(width - size - 24);
  expect(viewport().originY).toBe(height - size - 24);
});

test("the shortcut sheet teaches ⌘/Ctrl+Wheel to zoom and Wheel to pan", async () => {
  await openEditor(SPRITE);
  await userEvent.keyboard("?");
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect.element(dialog).toBeVisible();

  const view = [...dialog.element().querySelectorAll("section")].find(
    (section) => section.querySelector("h3")?.textContent === "View",
  )!;
  const rows = [...view.querySelectorAll("li")].map((row) => [
    row.querySelector("span")?.textContent,
    row.querySelector("kbd")?.textContent,
  ]);
  expect(rows).toContainEqual(["Zoom", `${formatModifier("mod")} + Wheel`]);
  expect(rows).toContainEqual(["Pan", "Wheel"]);
});

test("Ctrl/⌘+G and the grid popover both toggle the grid", async () => {
  const editor = await openEditor(SPRITE);
  const gridButton = editor.screen.getByRole("button", { name: "Grid options" });
  await expect.element(gridButton).toHaveAttribute("aria-pressed", "true");

  await userEvent.keyboard(mod("g"));
  expect(useViewStore.getState().gridEnabled).toBe(false);
  await expect.element(gridButton).toHaveAttribute("aria-pressed", "false");

  await userEvent.click(gridButton);
  await userEvent.click(editor.screen.getByRole("switch"));
  expect(useViewStore.getState().gridEnabled).toBe(true);
});

test("zooming never changes the document", async () => {
  const editor = await openEditor(SPRITE);
  editor.click({ x: 4, y: 4 });
  const centre = clientOf(editor, { x: 8, y: 8 });

  wheel(editor, centre, -100);
  await userEvent.keyboard("0");

  expect(paintedPixels()).toEqual(["4,4"]);
  expect(window.__spriteEditor!.history.canRedo).toBe(false);
});

test("the zoom level reads as a multiplier between − and +, and the status bar no longer shows it", async () => {
  const editor = await openEditor(SPRITE);
  const level = editor.screen.getByLabelText("Zoom level");
  await expect.element(level).toHaveTextContent(`${viewport().scale}×`);

  await userEvent.click(editor.screen.getByRole("button", { name: "Zoom in" }));
  await expect.element(level).toHaveTextContent(`${viewport().scale}×`);
  expect(document.querySelector("footer")!.textContent).not.toMatch(/%/);
});

test("zoom now reaches 48×", async () => {
  const editor = await openEditor({ width: 8, height: 8 });
  const zoomIn = editor.screen.getByRole("button", { name: "Zoom in" });
  while (viewport().scale < 48) await userEvent.click(zoomIn);
  await expect.element(zoomIn).toBeDisabled();
  expect(ZOOM_LEVELS.at(-1)).toBe(48);
});

test("resize canvas works in tiles: a new tile keeps the canvas size, and undo restores size and tile", async () => {
  const editor = await openEditor({ width: 32, height: 32 });
  const doc = session().doc;
  expect(doc.tileSize).toBe(16);

  await userEvent.click(editor.screen.getByRole("button", { name: "Sprite menu" }));
  await userEvent.click(editor.screen.getByRole("menuitem", { name: "Resize canvas…" }));
  await userEvent.click(editor.screen.getByRole("button", { name: "8×8" }));
  // 32px at 16 = 2×2; at 8 the same 32px is 4×4.
  await expect.element(editor.screen.getByLabelText("Columns")).toHaveValue(4);
  await userEvent.fill(editor.screen.getByLabelText("Columns"), "6");
  await userEvent.click(editor.screen.getByRole("button", { name: "Anchor top left" }));
  await userEvent.click(editor.screen.getByRole("button", { name: "Resize", exact: true }));

  expect([doc.width, doc.height, doc.tileSize]).toEqual([48, 32, 8]);
  await expect.poll(() => useViewStore.getState().gridSize).toBe(8);

  await userEvent.keyboard(KEYS.undo);
  expect([doc.width, doc.height, doc.tileSize]).toEqual([32, 32, 16]);
  await expect.poll(() => useViewStore.getState().gridSize).toBe(16);
});
