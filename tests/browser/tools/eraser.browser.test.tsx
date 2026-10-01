import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { brushBounds } from "@/core/pixels";
import { IS_APPLE } from "@/lib/keys";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  KEYS,
  keys,
  openEditor,
  paintedPixels,
  rectPoints,
  selectLayer,
  session,
  type Editor,
} from "@test/editor";
import { keyDown, keyUp, pressKey } from "@test/keys";

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

test("the eraser offers a size but no mirror, and never mirrors, even with the pencil's on", async () => {
  const editor = await openEditor();
  await filledCanvasWithEraser(editor);

  await expect.element(editor.screen.getByRole("button", { name: "1 pixels", exact: true })).toBeVisible();
  await expect
    .element(editor.screen.getByRole("button", { name: "Mirror horizontally" }))
    .not.toBeInTheDocument();

  const { setSetting } = useEditorStore.getState();
  setSetting("pencil", "mirrorHorizontal", true);
  setSetting("pencil", "mirrorVertical", true);
  setSetting("eraser", "mirrorHorizontal", true);
  setSetting("eraser", "mirrorVertical", true);
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

/** Fills the whole cel with the bucket, then goes back to the pencil through the sidebar. */
async function filledCanvasWithPencil(editor: Editor) {
  await userEvent.click(editor.screen.getByRole("button", { name: "Paint bucket" }));
  editor.click({ x: 0, y: 0 });
  await userEvent.click(editor.screen.getByRole("button", { name: "Pencil", exact: true }));
}

test("tapping E switches to the eraser for good", async () => {
  await openEditor();

  pressKey("e", "KeyE", 0, 100);

  expect(useEditorStore.getState().toolId).toBe("eraser");
});

test("holding E borrows the eraser and hands the pencil back on release", async () => {
  const editor = await openEditor();
  await filledCanvasWithPencil(editor);

  keyDown("e", { code: "KeyE", at: 0 });
  editor.click({ x: 7, y: 7 });
  keyUp("e", { code: "KeyE", at: 1000 });

  expect(paintedPixels()).toHaveLength(255);
  expect(useEditorStore.getState().toolId).toBe("pencil");
});

test("releasing a held E mid-stroke keeps erasing to the end, as one undo step", async () => {
  const editor = await openEditor();
  await filledCanvasWithPencil(editor);

  keyDown("e", { code: "KeyE", at: 0 });
  const stroke = editor.press({ x: 0, y: 3 });
  stroke.moveTo({ x: 5, y: 3 });
  keyUp("e", { code: "KeyE", at: 1000 });
  stroke.moveTo({ x: 15, y: 3 });
  stroke.release();

  expect(paintedPixels()).toHaveLength(256 - 16);
  expect(useEditorStore.getState().toolId).toBe("pencil");
  expect(session().history.undoLabel).toBe("Eraser");

  await userEvent.keyboard(KEYS.undo);
  expect(paintedPixels()).toHaveLength(256);
});

test("the window losing focus mid-hold hands the pencil back", async () => {
  await openEditor();

  keyDown("e", { code: "KeyE", at: 0 });
  window.dispatchEvent(new Event("blur"));

  expect(useEditorStore.getState()).toMatchObject({ toolId: "pencil", heldTool: null });
});

test("E typed into a text field, or with the command key, never switches tools", async () => {
  await openEditor();
  const input = document.body.appendChild(document.createElement("input"));

  keyDown("e", { code: "KeyE", at: 0, target: input });
  keyDown("e", { code: "KeyE", at: 10, ctrlKey: !IS_APPLE, metaKey: IS_APPLE });

  expect(useEditorStore.getState()).toMatchObject({ toolId: "pencil", heldTool: null });
  input.remove();
});

test("a hold survives the editor re-rendering while the key is down", async () => {
  const editor = await openEditor();

  keyDown("e", { code: "KeyE", at: 0 });
  await expect
    .element(editor.screen.getByRole("button", { name: "Eraser", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  keyUp("e", { code: "KeyE", at: 1000 });

  expect(useEditorStore.getState()).toMatchObject({ toolId: "pencil", heldTool: null });
});

test("pressing E on the eraser cycles the brush size shown in the options bar", async () => {
  const editor = await openEditor();
  await userEvent.click(editor.screen.getByRole("button", { name: "Eraser", exact: true }));

  for (const [index, size] of [2, 3, 4, 6, 8, 1].entries()) {
    pressKey("e", "KeyE", index * 1000, 50);
    await expect
      .element(editor.screen.getByRole("button", { name: `${size} pixels`, exact: true }))
      .toHaveAttribute("aria-pressed", "true");
  }
  expect(useEditorStore.getState()).toMatchObject({ toolId: "eraser", heldTool: null });
});
