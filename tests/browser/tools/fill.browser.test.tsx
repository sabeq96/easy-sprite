import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { useEditorStore } from "@/stores/useEditorStore";
import { KEYS, keys, openEditor, paintedPixels, pixelAt, rectPoints, type Editor } from "@test/editor";

const RED = { r: 255, g: 0, b: 0, a: 255 };
const BLUE = { r: 0, g: 0, b: 255, a: 255 };

/** A 7×7 black outline from (4,4) to (10,10), drawn with the pencil — a closed room of 5×5. */
function drawBox(editor: Editor) {
  editor.drag([
    { x: 4, y: 4 },
    { x: 10, y: 4 },
    { x: 10, y: 10 },
    { x: 4, y: 10 },
    { x: 4, y: 4 },
  ]);
}

async function chooseTool(editor: Editor, name: string) {
  const button = editor.screen.getByRole("button", { name, exact: true });
  await userEvent.click(button);
  await expect.element(button).toHaveAttribute("aria-pressed", "true");
}

test("the bucket fills the enclosed room and nothing outside its walls", async () => {
  const editor = await openEditor();
  drawBox(editor);
  await chooseTool(editor, "Paint bucket");
  useEditorStore.getState().setPrimaryColor(RED);

  editor.click({ x: 7, y: 7 });

  const room = rectPoints(5, 5, 5, 5);
  expect(room.every(({ x, y }) => pixelAt(x, y) === "#ff0000ff")).toBe(true);
  expect(pixelAt(4, 4)).toBe("#000000ff"); // wall untouched
  expect(pixelAt(0, 0)).toBe("#00000000"); // outside untouched
  expect(paintedPixels()).toHaveLength(24 + 25);
});

test("the bucket fills around the room from outside without leaking in", async () => {
  const editor = await openEditor();
  drawBox(editor);
  await chooseTool(editor, "Paint bucket");
  useEditorStore.getState().setPrimaryColor(RED);

  editor.click({ x: 0, y: 0 });

  expect(pixelAt(0, 0)).toBe("#ff0000ff");
  expect(pixelAt(15, 15)).toBe("#ff0000ff");
  expect(pixelAt(7, 7)).toBe("#00000000");
  expect(paintedPixels()).toHaveLength(256 - 25);
});

test("fill similar recolours every matching pixel, connected or not", async () => {
  const editor = await openEditor();
  editor.click({ x: 1, y: 1 });
  editor.click({ x: 14, y: 2 });
  editor.click({ x: 8, y: 13 });
  useEditorStore.getState().setPrimaryColor(BLUE);
  editor.click({ x: 5, y: 5 }); // a different colour that must survive
  await chooseTool(editor, "Fill similar");
  useEditorStore.getState().setPrimaryColor(RED);

  editor.click({ x: 1, y: 1 });

  expect([pixelAt(1, 1), pixelAt(14, 2), pixelAt(8, 13)]).toEqual([
    "#ff0000ff",
    "#ff0000ff",
    "#ff0000ff",
  ]);
  expect(pixelAt(5, 5)).toBe("#0000ffff");
  expect(paintedPixels()).toHaveLength(4);
});

test("fill similar on empty space also reaches inside closed rooms — unlike the bucket", async () => {
  const editor = await openEditor();
  drawBox(editor);
  await chooseTool(editor, "Fill similar");
  useEditorStore.getState().setPrimaryColor(RED);

  editor.click({ x: 0, y: 0 });

  expect(pixelAt(7, 7)).toBe("#ff0000ff");
  expect(pixelAt(4, 4)).toBe("#000000ff");
  expect(paintedPixels()).toHaveLength(256);
});

test("the right button fills with the secondary colour", async () => {
  const editor = await openEditor();
  await chooseTool(editor, "Paint bucket");
  useEditorStore.getState().setSecondaryColor(BLUE);

  editor.click({ x: 3, y: 3 }, { button: 2 });

  expect(keys(rectPoints(0, 0, 16, 16)).every((key) => paintedPixels().includes(key))).toBe(true);
  expect(pixelAt(15, 0)).toBe("#0000ffff");
});

test("dragging the bucket is still a single fill and a single undo step", async () => {
  const editor = await openEditor();
  drawBox(editor);
  await chooseTool(editor, "Paint bucket");
  useEditorStore.getState().setPrimaryColor(RED);

  // Starts inside the room and ends outside it: a one-shot tool ignores where the drag goes.
  editor.drag([{ x: 7, y: 7 }, { x: 8, y: 8 }, { x: 0, y: 0 }]);
  expect(pixelAt(0, 0)).toBe("#00000000");
  expect(pixelAt(7, 7)).toBe("#ff0000ff");

  await userEvent.keyboard(KEYS.undo);
  expect(pixelAt(7, 7)).toBe("#00000000");
  expect(pixelAt(4, 4)).toBe("#000000ff"); // the box, an earlier step, is still there
});

test("refilling with the colour already there changes nothing and records no undo step", async () => {
  const editor = await openEditor();
  editor.click({ x: 2, y: 2 });
  await chooseTool(editor, "Paint bucket");

  editor.click({ x: 2, y: 2 }); // black onto black

  await userEvent.keyboard(KEYS.undo);
  // The one step that existed was the pencil dot, so undo removes that.
  expect(paintedPixels()).toEqual([]);
});

test("the fill tools offer no brush options", async () => {
  const editor = await openEditor();
  for (const tool of ["Paint bucket", "Fill similar"]) {
    await chooseTool(editor, tool);
    await expect
      .element(editor.screen.getByRole("group", { name: "Brush size" }))
      .not.toBeInTheDocument();
    await expect
      .element(editor.screen.getByRole("button", { name: "Mirror horizontally" }))
      .not.toBeInTheDocument();
  }
});

test("a locked layer is not filled", async () => {
  const editor = await openEditor();
  await userEvent.click(editor.screen.getByRole("button", { name: "Lock Layer 1", exact: true }));
  await chooseTool(editor, "Paint bucket");

  editor.click({ x: 3, y: 3 });

  expect(paintedPixels()).toEqual([]);
});
