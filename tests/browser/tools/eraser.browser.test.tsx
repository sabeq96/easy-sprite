import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { brushBounds } from "@/editor/pixels";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  KEYS,
  keys,
  openEditor,
  paintedPixels,
  rectPoints,
  selectLayer,
  type Editor,
} from "@test/editor";

const ALL = rectPoints(0, 0, 16, 16);

/** Fills the whole cel with the bucket, then switches to the eraser through the sidebar. */
async function filledCanvasWithEraser(editor: Editor) {
  await userEvent.click(editor.screen.getByRole("button", { name: "Paint bucket" }));
  editor.click({ x: 0, y: 0 });
  expect(paintedPixels()).toHaveLength(256);
  await userEvent.click(editor.screen.getByRole("button", { name: "Eraser", exact: true }));
}

test.each([1, 3, 8])("a %ipx eraser clears exactly its square footprint", async (size) => {
  const editor = await openEditor();
  await filledCanvasWithEraser(editor);
  await userEvent.click(editor.screen.getByRole("button", { name: `${size} pixels`, exact: true }));

  editor.click({ x: 7, y: 7 });

  const { x, y, w, h } = brushBounds(7, 7, size);
  const erased = new Set(keys(rectPoints(x, y, w, h)));
  expect(paintedPixels()).toEqual(keys(ALL).filter((key) => !erased.has(key)));
});

test("an erase stroke clears a gap-free path", async () => {
  const editor = await openEditor();
  await filledCanvasWithEraser(editor);

  editor.drag([{ x: 0, y: 3 }, { x: 15, y: 3 }]);

  expect(paintedPixels()).toHaveLength(256 - 16);
  expect(paintedPixels().some((key) => key.endsWith(",3"))).toBe(false);
});

test("the right button erases too — the eraser has no secondary colour to paint", async () => {
  const editor = await openEditor();
  await filledCanvasWithEraser(editor);

  editor.click({ x: 5, y: 5 }, { button: 2 });

  expect(paintedPixels()).not.toContain("5,5");
  expect(paintedPixels()).toHaveLength(255);
});

test("the eraser offers a size but no mirror, and never mirrors even if the flag is stale", async () => {
  const editor = await openEditor();
  await filledCanvasWithEraser(editor);

  await expect.element(editor.screen.getByRole("button", { name: "1 pixels", exact: true })).toBeVisible();
  await expect
    .element(editor.screen.getByRole("button", { name: "Mirror horizontally" }))
    .not.toBeInTheDocument();

  useEditorStore.getState().setToolOptions({ mirrorHorizontal: true, mirrorVertical: true });
  editor.click({ x: 2, y: 2 });

  expect(paintedPixels()).toHaveLength(255);
  expect(paintedPixels()).toContain("13,2");
});

test("erasing only touches the active layer", async () => {
  const editor = await openEditor();
  await userEvent.click(editor.screen.getByRole("button", { name: "Paint bucket" }));
  editor.click({ x: 0, y: 0 }); // Layer 1 filled

  await userEvent.click(editor.screen.getByRole("button", { name: "New layer" }));
  await selectLayer(editor, "Layer 2");
  editor.click({ x: 0, y: 0 }); // Layer 2 filled too
  await userEvent.click(editor.screen.getByRole("button", { name: "Eraser", exact: true }));
  editor.click({ x: 4, y: 4 });

  expect(paintedPixels({ layer: 1 })).not.toContain("4,4");
  expect(paintedPixels({ layer: 0 })).toHaveLength(256);
});

test("an erase stroke undoes in one step and redoes back", async () => {
  const editor = await openEditor();
  await filledCanvasWithEraser(editor);
  editor.drag([{ x: 0, y: 0 }, { x: 15, y: 15 }]);
  const erased = paintedPixels();

  await userEvent.keyboard(KEYS.undo);
  expect(paintedPixels()).toHaveLength(256);

  await userEvent.keyboard(KEYS.redo);
  expect(paintedPixels()).toEqual(erased);
});
