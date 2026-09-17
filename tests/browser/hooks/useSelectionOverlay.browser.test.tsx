import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { AppRoutes } from "@/app/routes";
import { createSprite } from "@/db/repositories/sprites";
import { IS_APPLE } from "@/lib/keys";
import { useEditorStore } from "@/stores/useEditorStore";
import { render } from "@test/render";
import { clickSpritePixel, dragSpritePixels } from "@test/pointer";

const SELECT_ALL = IS_APPLE ? "{Meta>}a{/Meta}" : "{Control>}a{/Control}";
const COPY = IS_APPLE ? "{Meta>}c{/Meta}" : "{Control>}c{/Control}";
const PASTE = IS_APPLE ? "{Meta>}v{/Meta}" : "{Control>}v{/Control}";

/**
 * The overlay canvas also carries the pixel grid, which would make any pixel opaque regardless
 * of selection state — so the grid is switched off before checking for marching ants here.
 */
function hasOverlayInk(): boolean {
  const canvas = document.querySelector('canvas[data-canvas="overlay"]') as HTMLCanvasElement | null;
  const ctx = canvas?.getContext("2d");
  if (!ctx) return false;

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
  return false;
}

async function openEditor() {
  const sprite = await createSprite({ width: 16, height: 16 });
  const screen = render(<AppRoutes />, { route: `/sprites/${sprite.id}` });

  const canvas = screen.getByRole("application", { name: "Sprite canvas" });
  await expect.element(canvas).toBeVisible();
  await expect.poll(() => useEditorStore.getState().containerSize.width > 0).toBe(true);

  useEditorStore.getState().setGridEnabled(false);
  return { screen, canvas: canvas.element() };
}

test("Ctrl+A shows the marching ants immediately, with no hover needed first", async () => {
  const { canvas } = await openEditor();
  const { viewport } = useEditorStore.getState();
  // Copy needs a painted cel to read from; select-all itself doesn't, but this keeps the two
  // tests in this file symmetric.
  clickSpritePixel(canvas, viewport, { x: 8, y: 8 });
  expect(hasOverlayInk()).toBe(false);

  await userEvent.keyboard(SELECT_ALL);
  await expect.poll(hasOverlayInk).toBe(true);

  await userEvent.keyboard("{Escape}");
  await expect.poll(hasOverlayInk).toBe(false);
});

test("pasting after a deselect shows the restored selection immediately, with no hover needed", async () => {
  const { screen, canvas } = await openEditor();
  const { viewport } = useEditorStore.getState();

  // Copy reads the layer's existing cel, so there has to be one before selecting a region of it.
  clickSpritePixel(canvas, viewport, { x: 4, y: 4 });
  // The pencil's own hover preview lives on a separate overlay channel and would otherwise
  // still be sitting on the canvas at (4,4), contaminating the ink check below.
  canvas.dispatchEvent(new PointerEvent("pointerleave", { pointerId: 1, bubbles: true }));

  await userEvent.click(screen.getByRole("button", { name: "Select", exact: true }));
  dragSpritePixels(canvas, viewport, [
    { x: 2, y: 2 },
    { x: 6, y: 6 },
  ]);
  await expect.poll(() => useEditorStore.getState().selection !== null).toBe(true);

  await userEvent.keyboard(COPY);
  await userEvent.keyboard("{Escape}");
  await expect.poll(() => useEditorStore.getState().selection).toBeNull();
  await expect.poll(hasOverlayInk).toBe(false);

  await userEvent.keyboard(PASTE);
  await expect.poll(() => useEditorStore.getState().selection !== null).toBe(true);
  await expect.poll(hasOverlayInk).toBe(true);
});
