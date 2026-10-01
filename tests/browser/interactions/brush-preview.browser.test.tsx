import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { AppRoutes } from "@/app/routes";
import { createSprite } from "@/db/repositories/sprites";
import { useEditorStore } from "@/stores/useEditorStore";
import { render } from "@test/render";
import { hoverSpritePixel } from "@test/pointer";

const SPRITE_SIZE = 16;
const HOVERED = { x: 4, y: 4 };
/** Where a horizontal mirror of HOVERED lands. */
const MIRRORED = { x: SPRITE_SIZE - 1 - HOVERED.x, y: HOVERED.y };

/**
 * Alpha at the centre of one sprite cell on the overlay layer. Centre, not corner: the pixel
 * grid is drawn on the same layer along cell boundaries, so only the middle of a cell reports
 * the brush preview alone.
 */
function overlayAlphaAt(point: { x: number; y: number }): number {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-canvas="overlay"]');
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return 0;

  const { viewport } = useEditorStore.getState();
  const x = Math.round(viewport.originX + (point.x + 0.5) * viewport.scale);
  const y = Math.round(viewport.originY + (point.y + 0.5) * viewport.scale);
  return ctx.getImageData(x, y, 1, 1).data[3];
}

async function openEditor() {
  // The default test viewport is a narrow strip, which fits a 16px sprite at 0.5× — a one-pixel
  // brush would render sub-pixel and no footprint would be measurable.
  await page.viewport(1000, 700);
  const sprite = await createSprite({ width: SPRITE_SIZE, height: SPRITE_SIZE });
  const screen = await render(<AppRoutes />, { route: `/sprites/${sprite.id}` });
  const canvas = screen.getByRole("application", { name: "Sprite canvas" });
  await expect.element(canvas).toBeVisible();
  await expect.poll(() => useEditorStore.getState().containerSize.width > 0).toBe(true);
  return canvas.element();
}

/**
 * Hovers a cell and waits for the overlay to repaint. Waiting on a frame rather than polling
 * for ink, because the previous hover's ink is still on the layer — a poll would return before
 * the repaint that this hover triggered.
 */
async function hoverAndSettle(canvas: Element) {
  hoverSpritePixel(canvas, useEditorStore.getState().viewport, HOVERED);
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 50))),
  );
}

test("the pencil previews its mirrored footprint only while mirroring is on", async () => {
  const canvas = await openEditor();
  useEditorStore.getState().setTool("pencil");

  await hoverAndSettle(canvas);
  expect(overlayAlphaAt(MIRRORED)).toBe(0);

  useEditorStore.getState().setSetting("pencil", "mirrorHorizontal", true);
  await hoverAndSettle(canvas);
  expect(overlayAlphaAt(MIRRORED)).toBeGreaterThan(0);
});

test("the eraser preview is never mirrored", async () => {
  const canvas = await openEditor();

  const { setSetting, setTool } = useEditorStore.getState();
  setSetting("pencil", "mirrorHorizontal", true);
  setSetting("pencil", "mirrorVertical", true);
  setSetting("eraser", "mirrorHorizontal", true);
  setSetting("eraser", "mirrorVertical", true);
  setTool("eraser");

  await hoverAndSettle(canvas);

  expect(overlayAlphaAt(HOVERED)).toBeGreaterThan(0); // it still has a brush preview
  expect(overlayAlphaAt(MIRRORED)).toBe(0); // but no mirrored ghost
});

async function nextFrames() {
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 50))),
  );
}

test("the preview follows the pointer, leaving nothing behind", async () => {
  const canvas = await openEditor();
  const elsewhere = { x: 10, y: 10 };

  await hoverAndSettle(canvas);
  expect(overlayAlphaAt(HOVERED)).toBeGreaterThan(0);

  hoverSpritePixel(canvas, useEditorStore.getState().viewport, elsewhere);
  await nextFrames();
  expect(overlayAlphaAt(elsewhere)).toBeGreaterThan(0);
  expect(overlayAlphaAt(HOVERED)).toBe(0);
});

test("a new brush size shows at once, without moving the pointer", async () => {
  const canvas = await openEditor();
  const below = { x: HOVERED.x + 1, y: HOVERED.y + 1 };

  await hoverAndSettle(canvas);
  expect(overlayAlphaAt(below)).toBe(0);

  useEditorStore.getState().setSetting("pencil", "size", 2);
  await nextFrames();
  expect(overlayAlphaAt(below)).toBeGreaterThan(0);
});
