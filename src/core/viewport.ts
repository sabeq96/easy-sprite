import { VIEW_PADDING, WHEEL_ZOOM_BASE, WHEEL_ZOOM_DELTA, ZOOM_LEVELS } from "@/constants/canvas";
import { clamp, stepLadder } from "@/lib/math";

export interface Viewport {
  /** Screen (CSS) pixels per sprite pixel. */
  scale: number;
  /** Top-left of the sprite, in canvas CSS coordinates. */
  originX: number;
  originY: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Canvas-relative CSS point → integer sprite pixel. May be out of bounds; callers clamp. */
export function screenToSprite(viewport: Viewport, point: Point): Point {
  return {
    x: Math.floor((point.x - viewport.originX) / viewport.scale),
    y: Math.floor((point.y - viewport.originY) / viewport.scale),
  };
}

export function spriteToScreen(viewport: Viewport, point: Point): Point {
  return {
    x: point.x * viewport.scale + viewport.originX,
    y: point.y * viewport.scale + viewport.originY,
  };
}

/** Zoom keeping the sprite pixel under the cursor fixed on screen. */
export function zoomAt(viewport: Viewport, cursor: Point, nextScale: number): Viewport {
  const ratio = nextScale / viewport.scale;
  return {
    scale: nextScale,
    originX: cursor.x - (cursor.x - viewport.originX) * ratio,
    originY: cursor.y - (cursor.y - viewport.originY) * ratio,
  };
}

export function zoomStep(viewport: Viewport, cursor: Point, direction: 1 | -1): Viewport {
  return zoomAt(viewport, cursor, stepLadder(viewport.scale, ZOOM_LEVELS, direction));
}

/** How much a wheel or pinch event multiplies the scale: continuous, so zoom glides. */
export function wheelZoomFactor(deltaY: number): number {
  return WHEEL_ZOOM_BASE ** (-deltaY / WHEEL_ZOOM_DELTA);
}

/** Largest ladder scale that fits, centred, with padding. */
export function fitViewport(container: Size, sprite: Size, padding = VIEW_PADDING): Viewport {
  const available = {
    width: Math.max(1, container.width - padding * 2),
    height: Math.max(1, container.height - padding * 2),
  };
  const raw = Math.min(available.width / sprite.width, available.height / sprite.height);
  const scale = ZOOM_LEVELS.findLast((level) => level <= raw) ?? ZOOM_LEVELS[0];

  return {
    scale,
    originX: Math.round((container.width - sprite.width * scale) / 2),
    originY: Math.round((container.height - sprite.height * scale) / 2),
  };
}

/**
 * Per axis: a sprite that fits (with `padding` either side) sits centred and cannot be moved; one that
 * overflows can be scrolled until `padding` px show past either edge, and no further.
 */
export function constrainViewport(
  viewport: Viewport,
  container: Size,
  sprite: Size,
  padding = VIEW_PADDING,
): Viewport {
  const axis = (origin: number, available: number, length: number) => {
    const size = length * viewport.scale;
    if (size + padding * 2 <= available) return Math.round((available - size) / 2);
    return clamp(origin, available - size - padding, padding);
  };

  return {
    scale: viewport.scale,
    originX: axis(viewport.originX, container.width, sprite.width),
    originY: axis(viewport.originY, container.height, sprite.height),
  };
}
