import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  KEYS,
  compositeAt,
  modShift,
  openEditor,
  paintedPixels,
  pixelAt,
  selectLayer,
  session,
  type Editor,
} from "@test/editor";
import { settled } from "@test/dom";
import { holdDrag, releaseDrag } from "@test/pointer";

const RED = { r: 255, g: 0, b: 0, a: 255 };
const BLUE = { r: 0, g: 0, b: 255, a: 255 };

/** Layer names bottom-first, as the document stores them. */
const layerNames = () => session().doc.layers.map((layer) => layer.name);
const activeLayerName = () =>
  session().doc.layers.find((layer) => layer.id === useEditorStore.getState().activeLayerId)?.name;

/** Layer 1 with a red pixel at (2,2), Layer 2 on top with a blue one at (5,5); Layer 2 active. */
async function twoPaintedLayers(editor: Editor) {
  useEditorStore.getState().setPrimaryColor(RED);
  editor.click({ x: 2, y: 2 });
  await userEvent.click(editor.screen.getByRole("button", { name: "New layer" }));
  await selectLayer(editor, "Layer 2");
  useEditorStore.getState().setPrimaryColor(BLUE);
  editor.click({ x: 5, y: 5 });
}

const button = (editor: Editor, name: string) =>
  editor.screen.getByRole("button", { name, exact: true });

test("a new layer goes on top, and drawing on it leaves the layer below alone", async () => {
  const editor = await openEditor();
  await twoPaintedLayers(editor);

  expect(layerNames()).toEqual(["Layer 1", "Layer 2"]);
  expect(paintedPixels({ layer: 0 })).toEqual(["2,2"]);
  expect(paintedPixels({ layer: 1 })).toEqual(["5,5"]);
  // Both show in the merged image.
  expect(compositeAt(2, 2)).toBe("#ff0000ff");
  expect(compositeAt(5, 5)).toBe("#0000ffff");
});

test("an upper layer covers the one below in the merged image", async () => {
  const editor = await openEditor();
  useEditorStore.getState().setPrimaryColor(RED);
  editor.click({ x: 4, y: 4 });
  await userEvent.click(editor.screen.getByRole("button", { name: "New layer" }));
  await selectLayer(editor, "Layer 2");
  useEditorStore.getState().setPrimaryColor(BLUE);
  editor.click({ x: 4, y: 4 });

  expect(compositeAt(4, 4)).toBe("#0000ffff");
});

test("hiding a layer takes it out of the merged image, and showing it puts it back", async () => {
  const editor = await openEditor();
  await twoPaintedLayers(editor);

  await userEvent.click(button(editor, "Hide Layer 2"));
  expect(compositeAt(5, 5)).toBe("#00000000");
  expect(compositeAt(2, 2)).toBe("#ff0000ff");
  await expect.element(button(editor, "Show Layer 2")).toHaveAttribute("aria-pressed", "false");

  await userEvent.click(button(editor, "Show Layer 2"));
  expect(compositeAt(5, 5)).toBe("#0000ffff");

  // Toggling visibility is undoable like any edit.
  await userEvent.keyboard(KEYS.undo);
  expect(compositeAt(5, 5)).toBe("#00000000");
});

test("locking a layer blocks every tool that writes, and unlocking restores it", async () => {
  const editor = await openEditor();
  await twoPaintedLayers(editor);
  await userEvent.click(button(editor, "Lock Layer 2"));

  editor.click({ x: 9, y: 9 }); // pencil
  await userEvent.keyboard("e");
  editor.click({ x: 5, y: 5 }); // eraser
  await userEvent.keyboard("b");
  editor.click({ x: 0, y: 0 }); // bucket
  expect(paintedPixels({ layer: 1 })).toEqual(["5,5"]);

  await userEvent.click(button(editor, "Unlock Layer 2"));
  editor.click({ x: 0, y: 0 });
  expect(paintedPixels({ layer: 1 })).toHaveLength(256);
});

test("duplicate copies the active layer's pixels into a new layer right above it", async () => {
  const editor = await openEditor();
  editor.click({ x: 3, y: 3 });

  await userEvent.click(editor.screen.getByRole("button", { name: "Duplicate layer" }));

  expect(layerNames()).toEqual(["Layer 1", "Layer 1 copy"]);
  expect(paintedPixels({ layer: 1 })).toEqual(["3,3"]);
  // A real copy: editing the duplicate leaves the original untouched.
  await selectLayer(editor, "Layer 1 copy");
  editor.click({ x: 8, y: 8 });
  expect(paintedPixels({ layer: 0 })).toEqual(["3,3"]);
});

test("merge down folds the active layer into the one below, and undo splits them again", async () => {
  const editor = await openEditor();
  await twoPaintedLayers(editor);

  await userEvent.click(editor.screen.getByRole("button", { name: "Merge layer down" }));

  expect(layerNames()).toEqual(["Layer 1"]);
  expect(paintedPixels({ layer: 0 })).toEqual(["2,2", "5,5"]);
  expect(pixelAt(5, 5, { layer: 0 })).toBe("#0000ffff");

  await userEvent.keyboard(KEYS.undo);
  expect(layerNames()).toEqual(["Layer 1", "Layer 2"]);
  expect(paintedPixels({ layer: 0 })).toEqual(["2,2"]);
  expect(paintedPixels({ layer: 1 })).toEqual(["5,5"]);
});

test("merge down is unavailable on the bottom layer", async () => {
  const editor = await openEditor();
  await twoPaintedLayers(editor);
  await selectLayer(editor, "Layer 1");

  await expect
    .element(editor.screen.getByRole("button", { name: "Merge layer down" }))
    .toBeDisabled();
});

test("delete removes the active layer, can't remove the last one, and undo restores it", async () => {
  const editor = await openEditor();
  await expect.element(editor.screen.getByRole("button", { name: "Delete layer" })).toBeDisabled();

  await twoPaintedLayers(editor);
  await userEvent.click(editor.screen.getByRole("button", { name: "Delete layer" }));

  expect(layerNames()).toEqual(["Layer 1"]);
  // The selection falls back to a layer that still exists.
  await expect.poll(activeLayerName).toBe("Layer 1");

  await userEvent.keyboard(KEYS.undo);
  expect(layerNames()).toEqual(["Layer 1", "Layer 2"]);
  expect(paintedPixels({ layer: 1 })).toEqual(["5,5"]);
});

test("double-clicking a layer's name renames it; typing never triggers tool shortcuts", async () => {
  const editor = await openEditor();

  await userEvent.dblClick(button(editor, "Layer 1"));
  const input = editor.screen.getByRole("textbox", { name: "Layer name" });
  await expect.element(input).toHaveFocus();
  // "e", "b" and "s" are tool keys — none of them may fire while typing a name.
  await userEvent.clear(input);
  await userEvent.keyboard("Backdrop sky{Enter}");

  expect(layerNames()).toEqual(["Backdrop sky"]);
  expect(useEditorStore.getState().toolId).toBe("pencil");

  await userEvent.keyboard(KEYS.undo);
  expect(layerNames()).toEqual(["Layer 1"]);
});

test("Escape abandons a rename", async () => {
  const editor = await openEditor();

  await userEvent.dblClick(button(editor, "Layer 1"));
  const input = editor.screen.getByRole("textbox", { name: "Layer name" });
  await userEvent.clear(input);
  await userEvent.keyboard("Nope{Escape}");

  expect(layerNames()).toEqual(["Layer 1"]);
});

test("layer opacity dims the layer in the merged image and is one undo step", async () => {
  const editor = await openEditor();
  editor.click({ x: 1, y: 1 });

  await userEvent.click(button(editor, "Opacity of Layer 1"));
  // The popover holds the page's only slider besides the preview's fps; the opacity one comes last.
  const slider = editor.screen.getByRole("slider").last();
  await expect.element(slider).toBeVisible();
  (slider.element() as HTMLElement).focus();
  await userEvent.keyboard("{Home}");

  await expect.poll(() => session().doc.layers[0].opacity).toBe(0);
  expect(compositeAt(1, 1)).toBe("#00000000");
  // The pixels themselves are untouched — opacity is a layer property.
  expect(pixelAt(1, 1)).toBe("#000000ff");

  // Each keyboard step is its own undo entry that restores the value from before that step — and
  // undo works straight from the slider, with focus still on it.
  await userEvent.keyboard("{ArrowRight}{ArrowRight}");
  await expect.poll(() => session().doc.layers[0].opacity).toBe(0.02);
  await userEvent.keyboard(KEYS.undo);
  await expect.poll(() => session().doc.layers[0].opacity).toBe(0.01);
  await userEvent.keyboard(KEYS.undo);
  await userEvent.keyboard(KEYS.undo);
  await expect.poll(() => session().doc.layers[0].opacity).toBe(1);
  expect(pixelAt(1, 1)).toBe("#000000ff"); // the stroke before it is still there
});

test("Page Up and Page Down walk the active layer through the stack", async () => {
  const editor = await openEditor();
  await userEvent.click(editor.screen.getByRole("button", { name: "New layer" }));
  await userEvent.click(editor.screen.getByRole("button", { name: "New layer" }));
  await selectLayer(editor, "Layer 1");

  await userEvent.keyboard("{PageUp}");
  expect(activeLayerName()).toBe("Layer 3");
  await userEvent.keyboard("{PageUp}");
  expect(activeLayerName()).toBe("Layer 2");
  await userEvent.keyboard("{PageUp}");
  expect(activeLayerName()).toBe("Layer 2"); // stops at the top
  await userEvent.keyboard("{PageDown}{PageDown}{PageDown}");
  expect(activeLayerName()).toBe("Layer 1"); // …and at the bottom
});

test("Ctrl/⌘+Shift+N adds a layer from the keyboard", async () => {
  await openEditor();

  await userEvent.keyboard(modShift("n"));

  expect(layerNames()).toHaveLength(2);
});

test("dragging the bottom layer's row above the top one reorders the stack", async () => {
  const editor = await openEditor();
  await twoPaintedLayers(editor);

  const rows = () =>
    [...document.querySelectorAll("[aria-label='Layers'] li[data-drag-item='sortable']")];
  // Rows are displayed top-first: [Layer 2, Layer 1].
  const bottomRow = await settled(() => rows()[1]);
  const topRect = (await settled(() => rows()[0])).getBoundingClientRect();
  const to = { x: topRect.left + topRect.width / 2, y: topRect.top + 2 };

  await holdDrag(bottomRow, to);
  await releaseDrag(to);

  await expect.poll(layerNames).toEqual(["Layer 2", "Layer 1"]);
  // Layer 1's red is now above Layer 2 in the stack, pixels intact.
  expect(paintedPixels({ layer: 1 })).toEqual(["2,2"]);

  await userEvent.keyboard(KEYS.undo);
  expect(layerNames()).toEqual(["Layer 1", "Layer 2"]);
});

test("the active layer row is the one marked active in the panel", async () => {
  const editor = await openEditor();
  await userEvent.click(editor.screen.getByRole("button", { name: "New layer" }));
  await selectLayer(editor, "Layer 2");

  const activeRow = () => document.querySelector("[aria-label='Layers'] li[data-active]");
  await expect.poll(() => activeRow()?.textContent).toContain("Layer 2");

  await selectLayer(editor, "Layer 1");
  await expect.poll(() => activeRow()?.textContent).toContain("Layer 1");
});
