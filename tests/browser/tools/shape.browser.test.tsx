import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { usePaletteStore } from "@/editor/palette/api";
import { useToolboxStore } from "@/editor/toolbox/api";
import { forEachShapePixel, type ShapeKind } from "@/tools/shape/shapes";
import { KEYS, keys, openEditor, paintedPixels, pixelAt, rectPoints, type Editor } from "@test/editor";
import { pressKey } from "@test/keys";
import type { Point } from "@/core/viewport";

/** The pixels a shape between two corners should leave on an empty canvas. */
function expected(kind: ShapeKind, from: Point, to: Point, filled = false): string[] {
  const points: Point[] = [];
  forEachShapePixel(kind, from, to, filled, (x, y) => points.push({ x, y }));
  return keys(points);
}

async function openShapeTool(): Promise<Editor> {
  const editor = await openEditor();
  await userEvent.keyboard("r");
  expect(useToolboxStore.getState().toolId).toBe("shape");
  return editor;
}

const shapeSetting = () => useToolboxStore.getState().settings.shape?.shape ?? "rectangle";

test("R selects Shape, and R again cycles Rectangle → Ellipse → Line → Rectangle", async () => {
  await openShapeTool();
  expect(shapeSetting()).toBe("rectangle");

  for (const next of ["ellipse", "line", "rectangle"]) {
    pressKey("r", "KeyR", 0, 50);
    expect(shapeSetting()).toBe(next);
  }
  expect(useToolboxStore.getState().toolId).toBe("shape");
});

test("a drag draws a rectangle outline; shrinking the drag leaves no trace of the bigger preview", async () => {
  const editor = await openShapeTool();

  editor.drag([{ x: 2, y: 2 }, { x: 12, y: 12 }, { x: 5, y: 4 }]);

  expect(paintedPixels()).toEqual(expected("rectangle", { x: 2, y: 2 }, { x: 5, y: 4 }));
});

test("one undo removes the whole shape", async () => {
  const editor = await openShapeTool();

  editor.drag([{ x: 1, y: 1 }, { x: 6, y: 3 }, { x: 9, y: 7 }]);
  expect(paintedPixels()).not.toEqual([]);

  await userEvent.keyboard(KEYS.undo);
  expect(paintedPixels()).toEqual([]);
});

test.each(["ellipse", "line"] as const)("a drag draws the %s between its corners", async (kind) => {
  const editor = await openShapeTool();
  useToolboxStore.getState().setSetting("shape", "shape", kind);

  editor.drag([{ x: 1, y: 2 }, { x: 13, y: 9 }]);

  expect(paintedPixels()).toEqual(expected(kind, { x: 1, y: 2 }, { x: 13, y: 9 }));
});

test("F toggles Fill, and a filled rectangle covers its whole box", async () => {
  const editor = await openShapeTool();

  await userEvent.keyboard("f");
  await expect
    .element(editor.screen.getByRole("button", { name: "Fill" }))
    .toHaveAttribute("aria-pressed", "true");
  editor.drag([{ x: 2, y: 2 }, { x: 6, y: 5 }]);

  expect(paintedPixels()).toEqual(keys(rectPoints(2, 2, 5, 4)));
});

test("a right-drag draws with the secondary color", async () => {
  const editor = await openShapeTool();
  usePaletteStore.getState().setSecondaryColor({ r: 0, g: 255, b: 0, a: 255 });

  editor.drag([{ x: 2, y: 2 }, { x: 5, y: 2 }], { button: 2 });

  expect([2, 3, 4, 5].map((x) => pixelAt(x, 2))).toEqual(Array(4).fill("#00ff00ff"));
});

test("Shift turns a rectangle drag into a square", async () => {
  const editor = await openShapeTool();

  editor.drag([{ x: 2, y: 2 }, { x: 8, y: 4 }], { shiftKey: true });

  expect(paintedPixels()).toEqual(expected("rectangle", { x: 2, y: 2 }, { x: 8, y: 8 }));
});
