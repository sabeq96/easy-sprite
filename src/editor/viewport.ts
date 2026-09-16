import { ZOOM_LEVELS } from "@/constants/canvas";
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

export function isInsideSprite(point: Point, sprite: Size): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < sprite.width && point.y < sprite.height;
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

/** Largest ladder scale that fits, centred, with padding. */
export function fitViewport(container: Size, sprite: Size, padding = 24): Viewport {
  const available = {
    width: Math.max(1, container.width - padding * 2),
    height: Math.max(1, container.height - padding * 2),
  };
  const raw = Math.min(available.width / sprite.width, available.height / sprite.height);
  const scale = [...ZOOM_LEVELS].reverse().find((level) => level <= raw) ?? ZOOM_LEVELS[0];

  return {
    scale,
    originX: Math.round((container.width - sprite.width * scale) / 2),
    originY: Math.round((container.height - sprite.height * scale) / 2),
  };
}

/** Keeps part of the sprite on screen so it cannot be panned into the void. */
export function clampViewport(viewport: Viewport, container: Size, sprite: Size): Viewport {
  const margin = Math.min(
    Math.min(sprite.width, sprite.height) * viewport.scale * 0.25,
    Math.min(container.width, container.height) * 0.4,
  );

  return {
    ...viewport,
    originX: clamp(
      viewport.originX,
      -sprite.width * viewport.scale + margin,
      container.width - margin,
    ),
    originY: clamp(
      viewport.originY,
      -sprite.height * viewport.scale + margin,
      container.height - margin,
    ),
  };
}
