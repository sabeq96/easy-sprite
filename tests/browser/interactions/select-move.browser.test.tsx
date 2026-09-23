import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { AppRoutes } from "@/app/routes";
import { createSprite } from "@/db/repositories/sprites";
import { getPixel } from "@/editor/buffer";
import { IS_APPLE } from "@/lib/keys";
import { useEditorStore } from "@/stores/useEditorStore";
import { render } from "@test/render";
import { clickSpritePixel, dragSpritePixels, hoverSpritePixel } from "@test/pointer";

const SELECT_ALL = IS_APPLE ? "{Meta>}a{/Meta}" : "{Control>}a{/Control}";
const COPY = IS_APPLE ? "{Meta>}c{/Meta}" : "{Control>}c{/Control}";
const PASTE = IS_APPLE ? "{Meta>}v{/Meta}" : "{Control>}v{/Control}";

/**
 * The overlay canvas also carries the pixel grid and the hover cell, either of which would make
 * it inky regardless of the selection — so the grid is off and the pointer has left the canvas
 * before checking.
 */
function hasOverlayInk(): boolean {
  const canvas = document.querySelector('canvas[data-canvas="overlay"]') as HTMLCanvasElement | null;
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return false;

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
  return false;
}

function leave(canvas: Element) {
  canvas.dispatchEvent(new PointerEvent("pointerleave", { pointerId: 1, pointerType: "mouse" }));
}

function pixelAt(x: number, y: number) {
  const doc = window.__spriteEditor!.doc;
  const cel = doc.getCel(doc.layers[0].id, doc.frames[0].id)!;
  return getPixel(cel.pixels, x, y, doc.width);
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

test("Ctrl+A switches to the select tool and shows it; another tool hides it", async () => {
  const { canvas } = await openEditor();
  expect(useEditorStore.getState().toolId).toBe("pencil");

  await userEvent.keyboard(SELECT_ALL);
  expect(useEditorStore.getState().toolId).toBe("select");
  await expect.poll(hasOverlayInk).toBe(true);

  await userEvent.keyboard("p");
  leave(canvas);
  await expect.poll(hasOverlayInk).toBe(false);
});

test("dragging from inside the selection moves its pixels and shows a grab cursor", async () => {
  const { canvas } = await openEditor();
  const { viewport } = useEditorStore.getState();
  clickSpritePixel(canvas, viewport, { x: 2, y: 2 }); // pencil paints the pixel to move

  useEditorStore.getState().setTool("select");
  dragSpritePixels(canvas, viewport, [{ x: 1, y: 1 }, { x: 3, y: 3 }]);
  dragSpritePixels(canvas, viewport, [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 6, y: 2 }]);

  await expect.poll(() => pixelAt(6, 2).a).toBe(255);
  expect(pixelAt(2, 2).a).toBe(0);

  hoverSpritePixel(canvas, viewport, { x: 6, y: 2 });
  expect((canvas as HTMLElement).style.cursor).toBe("grab");
  hoverSpritePixel(canvas, viewport, { x: 0, y: 0 });
  expect((canvas as HTMLElement).style.cursor).toBe("");
});

test("paste after a deselect switches to the select tool and selects the pasted region", async () => {
  const { canvas } = await openEditor();
  const { viewport } = useEditorStore.getState();
  clickSpritePixel(canvas, viewport, { x: 8, y: 8 });
  leave(canvas);
  expect(hasOverlayInk()).toBe(false);

  await userEvent.keyboard(SELECT_ALL);
  await userEvent.keyboard(COPY);
  await userEvent.keyboard("{Escape}");
  await expect.poll(hasOverlayInk).toBe(false);

  await userEvent.keyboard("p");
  await userEvent.keyboard(PASTE);
  expect(useEditorStore.getState().toolId).toBe("select");
  await expect.poll(hasOverlayInk).toBe(true);
});
