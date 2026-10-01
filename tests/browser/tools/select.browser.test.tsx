import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { useEditorStore } from "@/stores/useEditorStore";
import { selectedRect } from "@/tools/select/tool";
import {
  KEYS,
  chooseTool,
  keys,
  openEditor,
  paintedPixels,
  pixelAt,
  rectPoints,
  selectFrame,
  selectLayer,
  session,
  type Editor,
} from "@test/editor";
import { keyDown, keyUp, pressKey } from "@test/keys";
import { usePaletteStore } from "@/editor/palette/api";
import { useViewStore } from "@/editor/view/api";

const RED = { r: 255, g: 0, b: 0, a: 255 };

/** A 3×3 red block at (2,2)–(4,4), painted with a 3px pencil, then the select tool. */
async function withRedBlock(editor: Editor) {
  usePaletteStore.getState().setPrimaryColor(RED);
  useEditorStore.getState().setSetting("pencil", "size", 3);
  editor.click({ x: 3, y: 3 });
  expect(paintedPixels()).toEqual(keys(rectPoints(2, 2, 3, 3)));
  await chooseTool(editor, "Select & move");
}

/** Marquee-selects the block by dragging over exactly its pixels. */
function selectBlock(editor: Editor) {
  editor.drag([{ x: 2, y: 2 }, { x: 4, y: 4 }]);
  expect(selectedRect()).toEqual({ x: 2, y: 2, w: 3, h: 3 });
}

test("a marquee drag selects the rectangle between its corners, whichever way it is dragged", async () => {
  const editor = await openEditor();
  await chooseTool(editor, "Select & move");

  editor.drag([{ x: 9, y: 8 }, { x: 3, y: 2 }]);
  expect(selectedRect()).toEqual({ x: 3, y: 2, w: 7, h: 7 });

  // A plain click is a one-pixel marquee.
  editor.click({ x: 12, y: 12 });
  expect(selectedRect()).toEqual({ x: 12, y: 12, w: 1, h: 1 });
});

test("Delete clears exactly the selected rectangle, and undo brings it back", async () => {
  const editor = await openEditor();
  await chooseTool(editor, "Paint bucket");
  editor.click({ x: 0, y: 0 });
  await chooseTool(editor, "Select & move");

  editor.drag([{ x: 4, y: 4 }, { x: 7, y: 6 }]);
  await userEvent.keyboard("{Delete}");

  const hole = new Set(keys(rectPoints(4, 4, 4, 3)));
  expect(paintedPixels()).toEqual(keys(rectPoints(0, 0, 16, 16)).filter((key) => !hole.has(key)));

  await userEvent.keyboard(KEYS.undo);
  expect(paintedPixels()).toHaveLength(256);
});

test("dragging from inside the selection moves its pixels and leaves the old spot empty", async () => {
  const editor = await openEditor();
  await withRedBlock(editor);
  selectBlock(editor);

  editor.drag([{ x: 3, y: 3 }, { x: 6, y: 5 }, { x: 10, y: 8 }]);

  expect(paintedPixels()).toEqual(keys(rectPoints(9, 7, 3, 3)));
  expect(pixelAt(9, 7)).toBe("#ff0000ff");
  // The selection follows the pixels.
  expect(selectedRect()).toEqual({ x: 9, y: 7, w: 3, h: 3 });
});

test("a move is one undo step that puts the pixels back where they were", async () => {
  const editor = await openEditor();
  await withRedBlock(editor);
  selectBlock(editor);
  editor.drag([{ x: 3, y: 3 }, { x: 10, y: 10 }]);

  await userEvent.keyboard(KEYS.undo);

  expect(paintedPixels()).toEqual(keys(rectPoints(2, 2, 3, 3)));
  // Undo moved pixels out from under the marquee, so it is dropped rather than left lying.
  expect(selectedRect()).toBeNull();

  await userEvent.keyboard(KEYS.redo);
  expect(paintedPixels()).toEqual(keys(rectPoints(9, 9, 3, 3)));
});

test("Ctrl-dragging the selection duplicates it instead of moving it", async () => {
  const editor = await openEditor();
  await withRedBlock(editor);
  selectBlock(editor);

  editor.drag([{ x: 3, y: 3 }, { x: 11, y: 3 }], { ctrlKey: true });

  expect(paintedPixels()).toEqual(keys([...rectPoints(2, 2, 3, 3), ...rectPoints(10, 2, 3, 3)]));
});

test("moving a selection partly off the canvas clips it, and undo restores all of it", async () => {
  const editor = await openEditor();
  await withRedBlock(editor);
  selectBlock(editor);

  editor.drag([{ x: 3, y: 3 }, { x: 15, y: 3 }]);

  // The block's left column lands on x=14; the rest falls off the right edge.
  expect(paintedPixels()).toEqual(keys(rectPoints(14, 2, 2, 3)));

  await userEvent.keyboard(KEYS.undo);
  expect(paintedPixels()).toEqual(keys(rectPoints(2, 2, 3, 3)));
});

test("clicking inside the selection without moving changes nothing", async () => {
  const editor = await openEditor();
  await withRedBlock(editor);
  selectBlock(editor);
  const { history } = window.__spriteEditor!;
  const undoLabel = history.canUndo;

  editor.click({ x: 3, y: 3 });

  expect(paintedPixels()).toEqual(keys(rectPoints(2, 2, 3, 3)));
  expect(selectedRect()).toEqual({ x: 2, y: 2, w: 3, h: 3 });
  expect(history.canUndo).toBe(undoLabel);
});

test("cut empties the selection and paste puts it back, selected and ready to drag", async () => {
  const editor = await openEditor();
  await withRedBlock(editor);
  selectBlock(editor);

  await userEvent.keyboard(KEYS.cut);
  expect(paintedPixels()).toEqual([]);

  await userEvent.keyboard(KEYS.paste);
  expect(paintedPixels()).toEqual(keys(rectPoints(2, 2, 3, 3)));
  expect(selectedRect()).toEqual({ x: 2, y: 2, w: 3, h: 3 });

  editor.drag([{ x: 3, y: 3 }, { x: 3, y: 10 }]);
  expect(paintedPixels()).toEqual(keys(rectPoints(2, 9, 3, 3)));
});

test("copy on one frame and paste on another copies the pixels across frames", async () => {
  const editor = await openEditor();
  await withRedBlock(editor);
  selectBlock(editor);
  await userEvent.keyboard(KEYS.copy);

  await userEvent.click(editor.screen.getByRole("button", { name: "New frame" }));
  await selectFrame(editor, 2);
  expect(paintedPixels({ frame: 1 })).toEqual([]);

  await userEvent.keyboard(KEYS.paste);

  expect(paintedPixels({ frame: 1 })).toEqual(keys(rectPoints(2, 2, 3, 3)));
  expect(paintedPixels({ frame: 0 })).toEqual(keys(rectPoints(2, 2, 3, 3)));
});

test("Escape deselects, after which Delete has nothing to delete", async () => {
  const editor = await openEditor();
  await withRedBlock(editor);
  selectBlock(editor);

  await userEvent.keyboard("{Escape}");
  expect(selectedRect()).toBeNull();

  await userEvent.keyboard("{Delete}");
  expect(paintedPixels()).toHaveLength(9);
});

test("select all covers the whole canvas and a drag then moves everything", async () => {
  const editor = await openEditor();
  await withRedBlock(editor);

  await userEvent.keyboard(KEYS.selectAll);
  expect(selectedRect()).toEqual({ x: 0, y: 0, w: 16, h: 16 });

  editor.drag([{ x: 8, y: 8 }, { x: 10, y: 9 }]);
  expect(paintedPixels()).toEqual(keys(rectPoints(4, 3, 3, 3)));
});

test("switching away from the select tool drops the selection", async () => {
  const editor = await openEditor();
  await withRedBlock(editor);
  selectBlock(editor);

  await chooseTool(editor, "Pencil");
  expect(selectedRect()).toBeNull();

  // Delete is a selection command: with nothing selected, it leaves the pixels alone.
  await userEvent.keyboard("{Delete}");
  expect(paintedPixels()).toHaveLength(9);
});

test("the selection moves pixels on the active layer only", async () => {
  const editor = await openEditor();
  await withRedBlock(editor); // on Layer 1
  await userEvent.click(editor.screen.getByRole("button", { name: "New layer" }));
  await selectLayer(editor, "Layer 2");
  await chooseTool(editor, "Select & move");

  editor.drag([{ x: 2, y: 2 }, { x: 4, y: 4 }]);
  editor.drag([{ x: 3, y: 3 }, { x: 10, y: 10 }]);

  // Layer 2 had nothing there to lift, so Layer 1's block is untouched.
  expect(paintedPixels({ layer: 0 })).toEqual(keys(rectPoints(2, 2, 3, 3)));
  expect(paintedPixels({ layer: 1 })).toEqual([]);
});

test("the select tool offers no brush options", async () => {
  const editor = await openEditor();
  await chooseTool(editor, "Select & move");

  await expect.element(editor.screen.getByRole("group", { name: "Brush size" })).not.toBeInTheDocument();
});

test("tapping S keeps Select & move", async () => {
  await openEditor();

  pressKey("s", "KeyS", 0, 100);

  expect(useEditorStore.getState().toolId).toBe("select");
});

test("releasing a held S mid-move puts the pixels back and adds no undo step", async () => {
  const editor = await openEditor();
  usePaletteStore.getState().setPrimaryColor(RED);
  useEditorStore.getState().setSetting("pencil", "size", 3);
  editor.click({ x: 3, y: 3 });
  const before = session().history.undoLabel;

  keyDown("s", { code: "KeyS", at: 0 });
  selectBlock(editor);
  const move = editor.press({ x: 3, y: 3 });
  move.moveTo({ x: 10, y: 10 });
  keyUp("s", { code: "KeyS", at: 1000 });
  move.moveTo({ x: 12, y: 12 });
  move.release();

  expect(useEditorStore.getState().toolId).toBe("pencil");
  expect(paintedPixels()).toEqual(keys(rectPoints(2, 2, 3, 3)));
  expect(session().history.undoLabel).toBe(before);
});

type RGB = [number, number, number];
const SELECTION_RGB: RGB = [59, 130, 246];
const GRID_RGB: RGB = [128, 128, 128];

/** The un-premultiplied colour and alpha of the overlay canvas at a CSS point. */
function overlayAt(css: { x: number; y: number }) {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-canvas="overlay"]')!;
  const dpr = canvas.width / canvas.getBoundingClientRect().width;
  const [r, g, b, a] = canvas.getContext("2d")!.getImageData(Math.floor(css.x * dpr), Math.floor(css.y * dpr), 1, 1).data;
  return { rgb: [r, g, b] as RGB, alpha: a };
}

const distance = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test("the selection fill draws above the grid lines", async () => {
  const editor = await openEditor();
  useViewStore.getState().setGridEnabled(true);
  useViewStore.getState().setGridSize(4);
  editor.leave();
  await userEvent.keyboard(KEYS.selectAll);
  expect(selectedRect()).toEqual({ x: 0, y: 0, w: 16, h: 16 });

  const { scale, originX, originY } = useViewStore.getState().viewport;
  const dpr = window.devicePixelRatio || 1;
  // The device pixel the 1.5px line at the x = 4 cell boundary fully covers.
  const onLine = { x: Math.round(originX + 4 * scale) + 0.5 / dpr, y: originY + 1.5 * scale };
  const offLine = { x: originX + 1.5 * scale, y: originY + 1.5 * scale };

  await expect.poll(() => overlayAt(onLine).alpha).toBeGreaterThan(overlayAt(offLine).alpha);
  const { rgb } = overlayAt(onLine);
  expect(distance(rgb, SELECTION_RGB)).toBeLessThan(distance(rgb, GRID_RGB));
});
