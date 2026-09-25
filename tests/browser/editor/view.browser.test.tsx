import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { ZOOM_LEVELS } from "@/constants/canvas";
import { screenToSprite, spriteToScreen, type Point } from "@/editor/viewport";
import { useEditorStore } from "@/stores/useEditorStore";
import { mod, openEditor, paintedPixels, type Editor } from "@test/editor";
import { dragClientPoints } from "@test/pointer";

/** Big enough to fit mid-ladder in the test viewport, so zoom can step both ways from the fit. */
const SPRITE = { width: 64, height: 64 };

const viewport = () => useEditorStore.getState().viewport;

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

function wheel(editor: Editor, client: { x: number; y: number }, deltaY: number) {
  editor.canvas.dispatchEvent(
    new WheelEvent("wheel", { deltaY, clientX: client.x, clientY: client.y, bubbles: true, cancelable: true }),
  );
}

const ladderIndex = (scale: number) => ZOOM_LEVELS.indexOf(scale as (typeof ZOOM_LEVELS)[number]);

test("the wheel zooms one ladder step at a time, in and back out", async () => {
  const editor = await openEditor(SPRITE);
  const start = viewport().scale;
  const centre = clientOf(editor, { x: 8, y: 8 });

  wheel(editor, centre, -100);
  expect(ladderIndex(viewport().scale)).toBe(ladderIndex(start) + 1);

  wheel(editor, centre, 100);
  wheel(editor, centre, 100);
  expect(ladderIndex(viewport().scale)).toBe(ladderIndex(start) - 1);
});

test("wheel zoom keeps the pixel under the cursor under the cursor", async () => {
  const editor = await openEditor(SPRITE);
  const cursor = clientOf(editor, { x: 3, y: 12 });

  wheel(editor, cursor, -100);
  expect(pixelUnder(editor, cursor)).toEqual({ x: 3, y: 12 });

  wheel(editor, cursor, 100);
  wheel(editor, cursor, 100);
  expect(pixelUnder(editor, cursor)).toEqual({ x: 3, y: 12 });
});

test("after zooming in on a pixel, a click at that same screen spot paints that pixel", async () => {
  const editor = await openEditor(SPRITE);
  const cursor = clientOf(editor, { x: 5, y: 5 });

  wheel(editor, cursor, -100);
  wheel(editor, cursor, -100);
  // Press at the very screen point the zoom was anchored on — not a recomputed one.
  dragClientPoints(editor.canvas, [cursor]);

  expect(paintedPixels()).toEqual(["5,5"]);
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

test("zoom stops at the ends of the ladder", async () => {
  const editor = await openEditor(SPRITE);
  const centre = clientOf(editor, { x: 8, y: 8 });

  for (let i = 0; i < ZOOM_LEVELS.length + 2; i++) wheel(editor, centre, -100);
  expect(viewport().scale).toBe(ZOOM_LEVELS.at(-1));

  for (let i = 0; i < ZOOM_LEVELS.length + 2; i++) wheel(editor, centre, 100);
  expect(viewport().scale).toBe(ZOOM_LEVELS[0]);
});

test("a middle-drag pans by exactly the distance dragged and paints nothing", async () => {
  const editor = await openEditor(SPRITE);
  const before = viewport();
  const from = clientOf(editor, { x: 8, y: 8 });

  dragClientPoints(editor.canvas, [from, { x: from.x + 30, y: from.y - 20 }], { button: 1 });

  expect(viewport().originX).toBe(before.originX + 30);
  expect(viewport().originY).toBe(before.originY - 20);
  expect(paintedPixels()).toEqual([]);
});

test("holding Space turns a left-drag into a pan", async () => {
  const editor = await openEditor(SPRITE);
  const before = viewport();
  const from = clientOf(editor, { x: 8, y: 8 });

  window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " " }));
  dragClientPoints(editor.canvas, [from, { x: from.x - 40, y: from.y + 10 }]);
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", key: " " }));

  expect(viewport().originX).toBe(before.originX - 40);
  expect(viewport().originY).toBe(before.originY + 10);
  expect(paintedPixels()).toEqual([]);
});

test("after panning, a click still paints the pixel under the pointer", async () => {
  const editor = await openEditor(SPRITE);
  const from = clientOf(editor, { x: 8, y: 8 });
  dragClientPoints(editor.canvas, [from, { x: from.x + 25, y: from.y + 35 }], { button: 1 });

  // The pixel that is now at the old centre is a different one — the pan moved the sprite.
  const target = pixelUnder(editor, from);
  expect(target).not.toEqual({ x: 8, y: 8 });
  dragClientPoints(editor.canvas, [from]);

  expect(paintedPixels()).toEqual([`${target.x},${target.y}`]);
});

test("the view cannot be panned so far that the sprite leaves the screen", async () => {
  const editor = await openEditor(SPRITE);
  const from = clientOf(editor, { x: 8, y: 8 });

  dragClientPoints(editor.canvas, [from, { x: from.x + 5000, y: from.y + 5000 }], { button: 1 });

  const { originX, originY, scale } = viewport();
  const { width, height } = editor.canvas.getBoundingClientRect();
  expect(originX).toBeLessThan(width);
  expect(originY).toBeLessThan(height);
  expect(originX + SPRITE.width * scale).toBeGreaterThan(0);

  // …and the same holds dragging the other way.
  dragClientPoints(editor.canvas, [from, { x: from.x - 9000, y: from.y - 9000 }], { button: 1 });
  expect(viewport().originX + SPRITE.width * viewport().scale).toBeGreaterThan(0);
  expect(viewport().originY + SPRITE.height * viewport().scale).toBeGreaterThan(0);
});

test("Ctrl/⌘+G and the grid popover both toggle the pixel grid", async () => {
  const editor = await openEditor(SPRITE);
  const gridButton = editor.screen.getByRole("button", { name: "Grid options" });
  await expect.element(gridButton).toHaveAttribute("aria-pressed", "true");

  await userEvent.keyboard(mod("g"));
  expect(useEditorStore.getState().gridEnabled).toBe(false);
  await expect.element(gridButton).toHaveAttribute("aria-pressed", "false");

  await userEvent.click(gridButton);
  await userEvent.click(editor.screen.getByRole("switch"));
  expect(useEditorStore.getState().gridEnabled).toBe(true);
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
