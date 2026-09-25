import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { useEditorStore } from "@/stores/useEditorStore";
import { activeColors, chooseTool, openEditor, selectLayer, type Editor } from "@test/editor";

const RED = { r: 255, g: 0, b: 0, a: 255 };
const GREEN = { r: 0, g: 255, b: 0, a: 255 };
const BLUE = { r: 0, g: 0, b: 255, a: 255 };

/** Paints one pixel in `color` with the pencil, leaving the pencil selected. */
function paint(editor: Editor, point: { x: number; y: number }, color: typeof RED) {
  useEditorStore.getState().setPrimaryColor(color);
  editor.click(point);
}

async function choosePicker(editor: Editor) {
  const button = editor.screen.getByRole("button", { name: "Color picker", exact: true });
  await userEvent.click(button);
  await expect.element(button).toHaveAttribute("aria-pressed", "true");
}

test("clicking picks the pixel's colour as primary, and the swatch shows it", async () => {
  const editor = await openEditor();
  paint(editor, { x: 3, y: 3 }, RED);
  useEditorStore.getState().setPrimaryColor(BLUE);
  await choosePicker(editor);

  editor.click({ x: 3, y: 3 });

  expect(activeColors().primary).toBe("#ff0000ff");
  await expect
    .element(editor.screen.getByRole("button", { name: "Primary color #ff0000ff" }))
    .toBeVisible();
});

test("right-clicking picks into the secondary colour and leaves the primary alone", async () => {
  const editor = await openEditor();
  paint(editor, { x: 3, y: 3 }, GREEN);
  useEditorStore.getState().setPrimaryColor(BLUE);
  await choosePicker(editor);

  editor.click({ x: 3, y: 3 }, { button: 2 });

  expect(activeColors()).toEqual({ primary: "#0000ffff", secondary: "#00ff00ff" });
});

test("dragging keeps sampling, so the colour under the release point wins", async () => {
  const editor = await openEditor();
  paint(editor, { x: 1, y: 1 }, RED);
  paint(editor, { x: 5, y: 1 }, GREEN);
  await choosePicker(editor);

  editor.drag([{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 }]);

  expect(activeColors().primary).toBe("#00ff00ff");
});

test("picking an empty pixel picks transparent", async () => {
  const editor = await openEditor();
  await choosePicker(editor);

  editor.click({ x: 9, y: 9 });

  expect(activeColors().primary.endsWith("00")).toBe(true);
});

test("with 'Sample merged image' on, it picks what you see through an empty layer on top", async () => {
  const editor = await openEditor();
  paint(editor, { x: 2, y: 2 }, RED); // on Layer 1
  await userEvent.click(editor.screen.getByRole("button", { name: "New layer" }));
  await selectLayer(editor, "Layer 2");
  await choosePicker(editor);
  useEditorStore.getState().setPrimaryColor(BLUE);

  const merged = editor.screen.getByRole("switch");
  await expect.element(merged).toBeChecked(); // the default

  editor.click({ x: 2, y: 2 });
  expect(activeColors().primary).toBe("#ff0000ff");
});

test("with 'Sample merged image' off, it only reads the active layer", async () => {
  const editor = await openEditor();
  paint(editor, { x: 2, y: 2 }, RED); // on Layer 1
  await userEvent.click(editor.screen.getByRole("button", { name: "New layer" }));
  await selectLayer(editor, "Layer 2");
  await choosePicker(editor);
  useEditorStore.getState().setPrimaryColor(BLUE);

  await userEvent.click(editor.screen.getByRole("switch"));
  await expect.element(editor.screen.getByRole("switch")).not.toBeChecked();
  await chooseTool(editor, "Pencil");
  paint(editor, { x: 12, y: 12 }, GREEN); // Layer 2 now has pixels of its own, elsewhere
  await choosePicker(editor);
  useEditorStore.getState().setPrimaryColor(BLUE);

  editor.click({ x: 2, y: 2 });
  // Layer 2 is empty at (2,2) — the red on Layer 1 underneath must not be picked.
  expect(activeColors().primary).toBe("#00000000");
});

test("holding Alt borrows the picker from the pencil, and releasing hands the pencil back", async () => {
  const editor = await openEditor();
  paint(editor, { x: 4, y: 4 }, RED);
  useEditorStore.getState().setPrimaryColor(BLUE);

  await userEvent.keyboard("{Alt>}");
  await expect
    .element(editor.screen.getByRole("button", { name: "Color picker", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  editor.click({ x: 4, y: 4 });
  await userEvent.keyboard("{/Alt}");

  expect(activeColors().primary).toBe("#ff0000ff");
  await expect
    .element(editor.screen.getByRole("button", { name: "Pencil", exact: true }))
    .toHaveAttribute("aria-pressed", "true");

  // …and the pencil now paints with the colour just picked.
  editor.click({ x: 8, y: 8 });
  expect(useEditorStore.getState().toolId).toBe("pencil");
});

test("the picker never changes a pixel", async () => {
  const editor = await openEditor();
  paint(editor, { x: 4, y: 4 }, RED);
  await choosePicker(editor);
  const before = window.__spriteEditor!.history.canUndo;

  editor.drag([{ x: 0, y: 0 }, { x: 15, y: 15 }]);
  editor.click({ x: 4, y: 4 }, { button: 2 });

  // Only the pencil dot is undoable: sampling records nothing.
  expect(before).toBe(true);
  window.__spriteEditor!.history.undo();
  expect(window.__spriteEditor!.history.canUndo).toBe(false);
});
