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

/** Which mouse button a gesture uses, and the modifiers held through it. */
export interface GestureOptions {
  /** 0 = primary (left), 1 = middle, 2 = secondary (right). */
  button?: number;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/** `event.buttons` is a bitmask whose middle and right bits are swapped relative to `button`. */
const BUTTONS_MASK: Record<number, number> = { 0: 1, 1: 4, 2: 2 };

function fire(
  target: Element | Document,
  type: string,
  clientX: number,
  clientY: number,
  pressed: boolean,
  { button = 0, ctrlKey = false, shiftKey = false, altKey = false }: GestureOptions = {},
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId: POINTER_ID,
      pointerType: "mouse",
      isPrimary: true,
      button: type === "pointermove" ? -1 : button,
      buttons: pressed ? BUTTONS_MASK[button] : 0,
      ctrlKey,
      shiftKey,
      altKey,
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

/** Moves the cursor over one sprite pixel without pressing — drives hover-only previews. */
export function hoverSpritePixel(container: Element, viewport: Viewport, point: Point): void {
  const { clientX, clientY } = clientPointFor(container, viewport, point);
  fire(container, "pointermove", clientX, clientY, false);
}

/** A pointer down + up over one sprite pixel — enough for a pencil stamp or a bucket fill. */
export function clickSpritePixel(
  container: Element,
  viewport: Viewport,
  point: Point,
  options: GestureOptions = {},
): void {
  const { clientX, clientY } = clientPointFor(container, viewport, point);
  fire(container, "pointerdown", clientX, clientY, true, options);
  fire(container, "pointerup", clientX, clientY, false, options);
}

/** A pointer down, a sequence of moves, then up — one continuous stroke over sprite pixels. */
export function dragSpritePixels(
  container: Element,
  viewport: Viewport,
  points: Point[],
  options: GestureOptions = {},
): void {
  const first = clientPointFor(container, viewport, points[0]);
  fire(container, "pointerdown", first.clientX, first.clientY, true, options);
  for (const point of points.slice(1)) {
    const { clientX, clientY } = clientPointFor(container, viewport, point);
    fire(container, "pointermove", clientX, clientY, true, options);
  }
  const last = clientPointFor(container, viewport, points.at(-1)!);
  fire(container, "pointerup", last.clientX, last.clientY, false, options);
}

/**
 * A drag in plain client pixels (not sprite pixels) — for gestures measured on screen, like
 * panning, where the start and end are about the view rather than any one pixel.
 */
export function dragClientPoints(
  container: Element,
  points: { x: number; y: number }[],
  options: GestureOptions = {},
): void {
  fire(container, "pointerdown", points[0].x, points[0].y, true, options);
  for (const point of points.slice(1)) fire(container, "pointermove", point.x, point.y, true, options);
  const last = points.at(-1)!;
  fire(container, "pointerup", last.x, last.y, false, options);
}

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

/**
 * Drags one element onto a point inside another, the way dnd-kit's PointerSensor sees it: the
 * `pointerdown` lands on the drag source, and the moves/up go to the document, where the sensor
 * attaches its listeners once a drag is live. The first move clears the sensor's 4px activation
 * distance, and a frame is awaited between events because dnd-kit measures rects asynchronously.
 */
export async function dragElementOnto(
  source: Element,
  target: Element,
  offset: Point = { x: 0, y: 0 },
  /** Extra 1px moves at the destination before release, the way a real hand never holds still —
   *  needed to catch a layout that shifts under the pointer once the drag arrives. */
  { settleMoves = 0 }: { settleMoves?: number } = {},
): Promise<void> {
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const endX = to.left + offset.x;
  const endY = to.top + offset.y;

  fire(source, "pointerdown", startX, startY, true);
  await nextFrame();
  fire(document, "pointermove", startX + 8, startY + 8, true); // clears the activation distance
  await nextFrame();
  fire(document, "pointermove", (startX + endX) / 2, (startY + endY) / 2, true);
  await nextFrame();
  fire(document, "pointermove", endX, endY, true);
  await nextFrame();
  for (let move = 1; move <= settleMoves; move += 1) {
    fire(document, "pointermove", endX + (move % 2), endY, true);
    await nextFrame();
  }
  fire(document, "pointerup", endX, endY, false);
  await nextFrame();
}

/**
 * Starts a drag from `source` and leaves the pointer held over `to` (client coordinates), for
 * asserting on what a drag shows before it is dropped. Pair with `releaseDrag`.
 *
 * It ends with a couple of 1px moves at the destination: dnd-kit measures the droppables once the
 * drag is live and only re-runs collision detection on the next move, so a pointer that jumps
 * onto a sortable and freezes there never sorts it — a real hand is never that still.
 */
export async function holdDrag(
  source: Element,
  to: { x: number; y: number },
  { settleMoves = 2 }: { settleMoves?: number } = {},
): Promise<void> {
  const from = source.getBoundingClientRect();
  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;

  fire(source, "pointerdown", startX, startY, true);
  await nextFrame();
  fire(document, "pointermove", startX + 8, startY + 8, true); // clears the activation distance
  await nextFrame();
  fire(document, "pointermove", to.x, to.y, true);
  await nextFrame();
  for (let move = 1; move <= settleMoves; move += 1) {
    fire(document, "pointermove", to.x - (move % 2), to.y, true);
    await nextFrame();
  }
  fire(document, "pointermove", to.x, to.y, true);
  await nextFrame();
}

/** Ends a drag started by `holdDrag`, at `to`. */
export async function releaseDrag(to: { x: number; y: number }): Promise<void> {
  fire(document, "pointerup", to.x, to.y, false);
  await nextFrame();
}

/** Releases a held drag without awaiting a frame — for asserting on what the very next tick shows. */
export function releaseDragNow(to: { x: number; y: number }): void {
  fire(document, "pointerup", to.x, to.y, false);
}
