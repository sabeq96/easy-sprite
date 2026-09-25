import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { BRUSH_SIZES } from "@/constants/tools";
import { createPalette } from "@/db/repositories/palettes";
import { brushBounds } from "@/editor/pixels";
import type { Point } from "@/editor/viewport";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  KEYS,
  keys,
  openEditor,
  paintedPixels,
  pixelAt,
  rectPoints,
  session,
  type Editor,
} from "@test/editor";

/** Every pixel one stamp of `size` covers at `point` — the footprint the options bar promises. */
function footprint(point: Point, size: number): Point[] {
  const { x, y, w, h } = brushBounds(point.x, point.y, size);
  return rectPoints(x, y, w, h);
}

async function pickSize(editor: Editor, size: number) {
  const toggle = editor.screen.getByRole("button", { name: `${size} pixels`, exact: true });
  await userEvent.click(toggle);
  await expect.element(toggle).toHaveAttribute("aria-pressed", "true");
}

async function toggleMirror(editor: Editor, axis: "horizontally" | "vertically") {
  await userEvent.click(editor.screen.getByRole("button", { name: `Mirror ${axis}` }));
}

test.each(BRUSH_SIZES)("a %ipx pencil stamps exactly its square footprint", async (size) => {
  const editor = await openEditor();
  await pickSize(editor, size);

  editor.click({ x: 7, y: 7 });

  expect(paintedPixels()).toEqual(keys(footprint({ x: 7, y: 7 }, size)));
});

test("a fast stroke between two distant samples still paints every pixel on the way", async () => {
  const editor = await openEditor();

  // Only the two end points are sampled — the pencil must join them, not leave dots.
  editor.drag([{ x: 1, y: 1 }, { x: 12, y: 1 }]);
  editor.drag([{ x: 1, y: 4 }, { x: 8, y: 11 }]);

  const row = rectPoints(1, 1, 12, 1);
  const diagonal = Array.from({ length: 8 }, (_, i) => ({ x: 1 + i, y: 4 + i }));
  expect(paintedPixels()).toEqual(keys([...row, ...diagonal]));
});

test("a thick stroke sweeps its whole brush along the path", async () => {
  const editor = await openEditor();
  await pickSize(editor, 3);

  editor.drag([{ x: 3, y: 5 }, { x: 10, y: 5 }]);

  // Size 3 is centred: rows 4–6, from one column left of the start to one right of the end.
  expect(paintedPixels()).toEqual(keys(rectPoints(2, 4, 10, 3)));
});

test("mirror horizontally paints the reflected pixel across the vertical axis", async () => {
  const editor = await openEditor();
  await toggleMirror(editor, "horizontally");

  editor.click({ x: 2, y: 3 });

  expect(paintedPixels()).toEqual(keys([{ x: 2, y: 3 }, { x: 13, y: 3 }]));
});

test("mirror vertically paints the reflected pixel across the horizontal axis", async () => {
  const editor = await openEditor();
  await toggleMirror(editor, "vertically");

  editor.click({ x: 2, y: 3 });

  expect(paintedPixels()).toEqual(keys([{ x: 2, y: 3 }, { x: 2, y: 12 }]));
});

test("both mirrors together paint all four quadrants", async () => {
  const editor = await openEditor();
  await toggleMirror(editor, "horizontally");
  await toggleMirror(editor, "vertically");

  editor.click({ x: 2, y: 3 });

  expect(paintedPixels()).toEqual(
    keys([
      { x: 2, y: 3 },
      { x: 13, y: 3 },
      { x: 2, y: 12 },
      { x: 13, y: 12 },
    ]),
  );
});

test("mirroring reflects the whole brush and the whole stroke, not just one pixel", async () => {
  const editor = await openEditor();
  await pickSize(editor, 2);
  await toggleMirror(editor, "horizontally");

  editor.drag([{ x: 1, y: 2 }, { x: 3, y: 2 }]);

  // Size 2 covers x..x+1, y..y+1; the mirror of pixel x is 15 - x.
  const stroke = [1, 2, 3].flatMap((x) => footprint({ x, y: 2 }, 2));
  const mirrored = [1, 2, 3].flatMap((x) => footprint({ x: 15 - x, y: 2 }, 2));
  expect(paintedPixels()).toEqual(keys([...stroke, ...mirrored]));
});

test("turning a mirror off again stops reflecting", async () => {
  const editor = await openEditor();
  await toggleMirror(editor, "horizontally");
  await toggleMirror(editor, "horizontally");
  await expect
    .element(editor.screen.getByRole("button", { name: "Mirror horizontally" }))
    .toHaveAttribute("aria-pressed", "false");

  editor.click({ x: 2, y: 3 });

  expect(paintedPixels()).toEqual(keys([{ x: 2, y: 3 }]));
});

test("mirroring is switched off when another tool is chosen, and stays off coming back", async () => {
  const editor = await openEditor();
  await toggleMirror(editor, "vertically");

  await userEvent.click(editor.screen.getByRole("button", { name: "Eraser", exact: true }));
  await userEvent.click(editor.screen.getByRole("button", { name: "Pencil", exact: true }));

  await expect
    .element(editor.screen.getByRole("button", { name: "Mirror vertically" }))
    .toHaveAttribute("aria-pressed", "false");
  editor.click({ x: 2, y: 3 });
  expect(paintedPixels()).toEqual(keys([{ x: 2, y: 3 }]));
});

test("the brush size is shared with the eraser and survives a tool switch", async () => {
  const editor = await openEditor();
  await pickSize(editor, 4);

  await userEvent.click(editor.screen.getByRole("button", { name: "Eraser", exact: true }));
  await expect
    .element(editor.screen.getByRole("button", { name: "4 pixels", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await userEvent.click(editor.screen.getByRole("button", { name: "Pencil", exact: true }));

  editor.click({ x: 7, y: 7 });
  expect(paintedPixels()).toHaveLength(16);
});

test("left paints the primary colour and right paints the secondary, both picked from the palette", async () => {
  const palette = await createPalette("Test", ["#ff0000", "#00ff00"]);
  const editor = await openEditor();
  useEditorStore.getState().setActivePalette(palette.id);

  await userEvent.click(editor.screen.getByRole("button", { name: "Color #ff0000ff" }).first());
  await userEvent.click(editor.screen.getByRole("button", { name: "Color #00ff00ff" }).first(), {
    button: "right",
  });

  editor.click({ x: 1, y: 1 });
  editor.drag([{ x: 3, y: 1 }, { x: 5, y: 1 }], { button: 2 });

  expect(pixelAt(1, 1)).toBe("#ff0000ff");
  expect([3, 4, 5].map((x) => pixelAt(x, 1))).toEqual(["#00ff00ff", "#00ff00ff", "#00ff00ff"]);
});

test("a translucent colour blends over what is already there", async () => {
  const editor = await openEditor();
  editor.click({ x: 1, y: 1 }); // opaque black

  useEditorStore.getState().setPrimaryColor({ r: 255, g: 255, b: 255, a: 128 });
  editor.click({ x: 1, y: 1 });
  editor.click({ x: 3, y: 1 });

  // Over black it mixes to a mid grey that stays opaque; over nothing it stays translucent white.
  const [r, , , a] = pixelAt(1, 1).slice(1).match(/../g)!.map((pair) => parseInt(pair, 16));
  expect(a).toBe(255);
  expect(r).toBeGreaterThan(100);
  expect(r).toBeLessThan(160);
  expect(pixelAt(3, 1)).toBe("#ffffff80");
});

test("a locked layer cannot be painted until it is unlocked", async () => {
  const editor = await openEditor();
  await userEvent.click(editor.screen.getByRole("button", { name: "Lock Layer 1", exact: true }));

  editor.click({ x: 4, y: 4 });
  expect(paintedPixels()).toEqual([]);

  await userEvent.click(editor.screen.getByRole("button", { name: "Unlock Layer 1", exact: true }));
  editor.click({ x: 4, y: 4 });
  expect(paintedPixels()).toEqual(["4,4"]);
});

test("a hidden layer cannot be painted — you would be drawing blind", async () => {
  const editor = await openEditor();
  await userEvent.click(editor.screen.getByRole("button", { name: "Hide Layer 1", exact: true }));

  editor.click({ x: 4, y: 4 });

  expect(paintedPixels()).toEqual([]);
});

test("one stroke, however long, is exactly one undo step", async () => {
  const editor = await openEditor();
  editor.click({ x: 0, y: 0 });
  editor.drag([{ x: 2, y: 2 }, { x: 9, y: 2 }, { x: 9, y: 9 }]);

  await userEvent.keyboard(KEYS.undo);
  expect(paintedPixels()).toEqual(["0,0"]);

  await userEvent.keyboard(KEYS.redo);
  expect(paintedPixels()).toHaveLength(1 + 8 + 7);
});

test("strokes past the canvas edge clip instead of wrapping or throwing", async () => {
  const editor = await openEditor();
  await pickSize(editor, 4);

  editor.click({ x: 0, y: 0 });
  editor.click({ x: 15, y: 15 });

  // Size 4 spans x-1..x+2: only the in-canvas part of each stamp lands.
  expect(paintedPixels()).toEqual(keys([...rectPoints(0, 0, 3, 3), { x: 14, y: 14 }, { x: 15, y: 14 }, { x: 14, y: 15 }, { x: 15, y: 15 }]));
  expect(session().doc.width).toBe(16);
});
