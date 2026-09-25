import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { spriteToScreen } from "@/editor/viewport";
import { useEditorStore } from "@/stores/useEditorStore";
import { KEYS, chooseTool, openEditor, paintedPixels, type Editor } from "@test/editor";

/**
 * Every tool, what the options bar must offer for it, and its key. Written out rather than derived
 * from the tool registry, so a tool that quietly gains or loses an option fails here.
 */
const TOOLS = [
  { label: "Pencil", key: "p", size: true, mirror: true, pickSource: false },
  { label: "Eraser", key: "e", size: true, mirror: false, pickSource: false },
  { label: "Paint bucket", key: "b", size: false, mirror: false, pickSource: false },
  { label: "Fill similar", key: "g", size: false, mirror: false, pickSource: false },
  { label: "Color picker", key: "o", size: false, mirror: false, pickSource: true },
  { label: "Select & move", key: "s", size: false, mirror: false, pickSource: false },
] as const;

test.each(TOOLS)("$label: its key selects it and the options bar offers exactly its options", async (tool) => {
  const editor = await openEditor();
  if (tool.key === "p") await userEvent.keyboard("e"); // start somewhere else

  await userEvent.keyboard(tool.key);

  await expect
    .element(editor.screen.getByRole("button", { name: tool.label, exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  // Only one tool is ever pressed.
  for (const other of TOOLS.filter((candidate) => candidate !== tool)) {
    await expect
      .element(editor.screen.getByRole("button", { name: other.label, exact: true }))
      .toHaveAttribute("aria-pressed", "false");
  }

  const present = async (locator: ReturnType<typeof editor.screen.getByRole>, expected: boolean) =>
    expected
      ? expect.element(locator).toBeInTheDocument()
      : expect.element(locator).not.toBeInTheDocument();
  await present(editor.screen.getByRole("button", { name: "3 pixels", exact: true }), tool.size);
  await present(editor.screen.getByRole("button", { name: "Mirror horizontally" }), tool.mirror);
  await present(editor.screen.getByRole("button", { name: "Mirror vertically" }), tool.mirror);
  await present(editor.screen.getByText("Sample merged image"), tool.pickSource);
});

test("tool keys typed into a text field never switch tools", async () => {
  const editor = await openEditor();

  await userEvent.click(editor.screen.getByRole("textbox", { name: "Sprite name" }));
  await userEvent.keyboard("bogeps");

  expect(useEditorStore.getState().toolId).toBe("pencil");
});

/** A gesture per writing tool, each of which changes the (empty or filled) canvas. */
const WRITERS = [
  { label: "Pencil", act: (editor: Editor) => editor.drag([{ x: 1, y: 1 }, { x: 9, y: 9 }]) },
  { label: "Eraser", act: (editor: Editor) => editor.drag([{ x: 1, y: 1 }, { x: 9, y: 9 }]) },
  { label: "Paint bucket", act: (editor: Editor) => editor.click({ x: 3, y: 12 }) },
  { label: "Fill similar", act: (editor: Editor) => editor.click({ x: 3, y: 12 }) },
  {
    label: "Select & move",
    act: (editor: Editor) => {
      editor.drag([{ x: 0, y: 0 }, { x: 5, y: 5 }]);
      editor.drag([{ x: 2, y: 2 }, { x: 9, y: 9 }]);
    },
  },
] as const;

test.each(WRITERS)("$label: one gesture is one undo step, and redo replays it exactly", async (tool) => {
  const editor = await openEditor();
  // A starting picture every tool can visibly change: a filled 8×8 block top-left.
  useEditorStore.getState().setToolOptions({ brushSize: 8 });
  editor.click({ x: 3, y: 3 });
  useEditorStore.getState().setToolOptions({ brushSize: 1 });
  useEditorStore.getState().setPrimaryColor({ r: 255, g: 0, b: 0, a: 255 });
  const before = paintedPixels();

  await chooseTool(editor, tool.label);
  tool.act(editor);
  const after = paintedPixels();
  expect(after).not.toEqual(before);

  await userEvent.keyboard(KEYS.undo);
  expect(paintedPixels()).toEqual(before);
  await userEvent.keyboard(KEYS.redo);
  expect(paintedPixels()).toEqual(after);
});

/** Alpha of the overlay canvas at the centre of a sprite pixel. */
function overlayAlphaAt(point: { x: number; y: number }) {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-canvas="overlay"]')!;
  const ratio = canvas.width / canvas.getBoundingClientRect().width;
  const screen = spriteToScreen(useEditorStore.getState().viewport, { x: point.x + 0.5, y: point.y + 0.5 });
  return canvas.getContext("2d")!.getImageData(Math.round(screen.x * ratio), Math.round(screen.y * ratio), 1, 1)
    .data[3];
}

async function hoverAndSettle(editor: Editor, point: { x: number; y: number }) {
  editor.hover(point);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 30))));
}

test.each(["Pencil", "Eraser"])("%s: the hover preview is as big as the brush", async (label) => {
  const editor = await openEditor();
  useEditorStore.getState().setGridEnabled(false);
  await chooseTool(editor, label);

  await hoverAndSettle(editor, { x: 8, y: 8 });
  expect(overlayAlphaAt({ x: 8, y: 8 })).toBeGreaterThan(0);
  expect(overlayAlphaAt({ x: 9, y: 9 })).toBe(0);

  await userEvent.click(editor.screen.getByRole("button", { name: "3 pixels", exact: true }));
  await hoverAndSettle(editor, { x: 8, y: 8 });
  expect(overlayAlphaAt({ x: 9, y: 9 })).toBeGreaterThan(0);
  expect(overlayAlphaAt({ x: 10, y: 10 })).toBe(0);
});

test("a tool switched mid-stroke does not hijack the stroke already in progress", async () => {
  const editor = await openEditor();
  const box = editor.canvas.getBoundingClientRect();
  const at = (x: number, y: number) => {
    const screen = spriteToScreen(useEditorStore.getState().viewport, { x: x + 0.5, y: y + 0.5 });
    return { clientX: box.left + screen.x, clientY: box.top + screen.y };
  };
  const fire = (type: string, x: number, y: number, buttons: number) =>
    editor.canvas.dispatchEvent(
      new PointerEvent(type, { pointerId: 1, pointerType: "mouse", button: type === "pointermove" ? -1 : 0, buttons, bubbles: true, ...at(x, y) }),
    );

  fire("pointerdown", 2, 2, 1);
  await userEvent.keyboard("e"); // the eraser, mid-stroke
  fire("pointermove", 6, 2, 1);
  fire("pointerup", 6, 2, 0);

  // The pencil started the stroke, so the pencil finishes it.
  expect(paintedPixels()).toEqual(["2,2", "3,2", "4,2", "5,2", "6,2"]);
  expect(useEditorStore.getState().toolId).toBe("eraser");

  // …and the next stroke is the eraser's.
  editor.drag([{ x: 2, y: 2 }, { x: 4, y: 2 }]);
  expect(paintedPixels()).toEqual(["5,2", "6,2"]);
});
