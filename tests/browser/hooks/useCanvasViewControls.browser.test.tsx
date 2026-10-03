import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { AppRoutes } from "@/app/routes";
import { createSprite } from "@/db/repositories/sprites";
import { useViewStore } from "@/editor/view/api";
import { render } from "@test/render";

async function openEditor() {
  // 64px, so zooming in can make it overflow the view (a sprite that fits stays centred and won't pan).
  const sprite = await createSprite({ width: 64, height: 64 });
  const screen = await render(<AppRoutes />, { route: `/sprites/${sprite.id}` });

  const canvas = screen.getByRole("application", { name: "Sprite canvas" });
  await expect.element(canvas).toBeVisible();
  await expect.poll(() => useViewStore.getState().containerSize.width > 0).toBe(true);

  return { screen, canvas: canvas.element() as HTMLElement };
}

function fireMiddleDrag(element: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }) {
  const base = { pointerId: 1, pointerType: "mouse", isPrimary: true, bubbles: true, cancelable: true };
  element.dispatchEvent(
    new PointerEvent("pointerdown", { ...base, button: 1, buttons: 4, clientX: from.x, clientY: from.y }),
  );
  element.dispatchEvent(
    new PointerEvent("pointermove", { ...base, button: 1, buttons: 4, clientX: to.x, clientY: to.y }),
  );
  element.dispatchEvent(
    new PointerEvent("pointerup", { ...base, button: 1, buttons: 0, clientX: to.x, clientY: to.y }),
  );
}

test("middle-drag pans the viewport without ever setting a custom cursor", async () => {
  const { canvas } = await openEditor();
  // A sprite that fits stays centred; zoom in until it overflows so there is something to pan.
  const { width, height } = useViewStore.getState().containerSize;
  const scale = () => useViewStore.getState().viewport.scale;
  while (64 * scale() < 2 * Math.max(width, height) && scale() < 48) {
    await userEvent.keyboard("+");
  }
  const before = useViewStore.getState().viewport;
  expect(canvas.style.cursor).toBe("");

  fireMiddleDrag(canvas, { x: 40, y: 40 }, { x: 65, y: 70 });

  const after = useViewStore.getState().viewport;
  expect(after.originX).not.toBe(before.originX);
  expect(after.originY).not.toBe(before.originY);
  expect(canvas.style.cursor).toBe("");
});

test("holding Space does not set a custom cursor either", async () => {
  const { canvas } = await openEditor();

  window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
  expect(canvas.style.cursor).toBe("");

  window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
  expect(canvas.style.cursor).toBe("");
});

test("switching tools never applies a per-tool cursor", async () => {
  const { screen, canvas } = await openEditor();

  for (const name of ["Pencil", "Eraser", "Paint bucket", "Color picker", "Select & move"]) {
    await userEvent.click(screen.getByRole("button", { name, exact: true }));
    expect(canvas.style.cursor).toBe("");
  }
});
