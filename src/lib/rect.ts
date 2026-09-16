export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const EMPTY_RECT: Rect = { x: 0, y: 0, w: 0, h: 0 };

export function rectFromPoints(x0: number, y0: number, x1: number, y1: number): Rect {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return { x, y, w: Math.abs(x1 - x0) + 1, h: Math.abs(y1 - y0) + 1 };
}

export function rectUnion(a: Rect | null, b: Rect): Rect {
  if (!a || a.w === 0 || a.h === 0) return b;
  if (b.w === 0 || b.h === 0) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

export function rectClamp(rect: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.min(rect.x, width));
  const y = Math.max(0, Math.min(rect.y, height));
  return {
    x,
    y,
    w: Math.max(0, Math.min(rect.w + rect.x - x, width - x)),
    h: Math.max(0, Math.min(rect.h + rect.y - y, height - y)),
  };
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}

export function rectIsEmpty(rect: Rect | null): boolean {
  return !rect || rect.w <= 0 || rect.h <= 0;
}
