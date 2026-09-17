import { spriteToScreen, type Point, type Viewport } from "@/editor/viewport";

/**
 * `userEvent` has no low-level pointer-drag API (jsdom's does, but this project's browser
 * project runs in a real Chromium tab, where the test file itself executes in-page). A plain
 * `dispatchEvent` reaches the same native `pointerdown`/`pointermove`/`pointerup` listeners
 * `usePointerPaint` attaches, so it drives the real renderer exactly like a real mouse would.
 *
 * Targets are given in sprite-pixel space and converted through the live `viewport`, rather than
 * "roughly the middle of the container" — the container is fit to the sprite by a ResizeObserver
 * whose first measurement can land oddly inside a headless browser tab, so only a coordinate
 * computed from the same viewport the app is using is guaranteed to land on the sprite at all.
 */
const POINTER_ID = 1;

function fire(target: Element, type: string, clientX: number, clientY: number, buttons: number) {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId: POINTER_ID,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons,
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
    }),
  );
}

function clientPointFor(container: Element, viewport: Viewport, point: Point) {
  const box = container.getBoundingClientRect();
  // +0.5 aims at the pixel's centre, not its top-left corner, so rounding never lands it
  // just outside the pixel it is meant to hit.
  const screen = spriteToScreen(viewport, { x: point.x + 0.5, y: point.y + 0.5 });
  return { clientX: box.left + screen.x, clientY: box.top + screen.y };
}

/** A pointer down + up over one sprite pixel — enough for a pencil stamp or a bucket fill. */
export function clickSpritePixel(container: Element, viewport: Viewport, point: Point): void {
  const { clientX, clientY } = clientPointFor(container, viewport, point);
  fire(container, "pointerdown", clientX, clientY, 1);
  fire(container, "pointerup", clientX, clientY, 0);
}

/** A pointer down, a sequence of moves, then up — one continuous stroke over sprite pixels. */
export function dragSpritePixels(container: Element, viewport: Viewport, points: Point[]): void {
  const first = clientPointFor(container, viewport, points[0]);
  fire(container, "pointerdown", first.clientX, first.clientY, 1);
  for (const point of points.slice(1)) {
    const { clientX, clientY } = clientPointFor(container, viewport, point);
    fire(container, "pointermove", clientX, clientY, 1);
  }
  const last = clientPointFor(container, viewport, points.at(-1)!);
  fire(container, "pointerup", last.clientX, last.clientY, 0);
}
