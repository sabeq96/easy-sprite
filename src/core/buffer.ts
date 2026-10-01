import type { RGBA } from "@/lib/color";
import type { PixelBuffer } from "@/types/pixels";
import type { Rect } from "@/lib/rect";

export const BYTES_PER_PIXEL = 4;

export function createBuffer(width: number, height: number): PixelBuffer {
  return new Uint8ClampedArray(width * height * BYTES_PER_PIXEL);
}

export function bufferIndex(x: number, y: number, width: number): number {
  return (y * width + x) * BYTES_PER_PIXEL;
}

export function getPixel(
  buffer: PixelBuffer,
  x: number,
  y: number,
  width: number,
): RGBA {
  const index = bufferIndex(x, y, width);
  return {
    r: buffer[index],
    g: buffer[index + 1],
    b: buffer[index + 2],
    a: buffer[index + 3],
  };
}

/** Replaces the pixel outright — no blending. Callers choose blending explicitly. */
export function setPixel(
  buffer: PixelBuffer,
  x: number,
  y: number,
  width: number,
  color: RGBA,
): void {
  const index = bufferIndex(x, y, width);
  buffer[index] = color.r;
  buffer[index + 1] = color.g;
  buffer[index + 2] = color.b;
  buffer[index + 3] = color.a;
}

/** Straight-alpha source-over, used when the active colour is semi-transparent. */
export function blendPixel(
  buffer: PixelBuffer,
  x: number,
  y: number,
  width: number,
  source: RGBA,
): void {
  if (source.a === 255) {
    setPixel(buffer, x, y, width, source);
    return;
  }
  if (source.a === 0) return;

  const index = bufferIndex(x, y, width);
  const sourceAlpha = source.a / 255;
  const destAlpha = buffer[index + 3] / 255;
  const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
  if (outAlpha === 0) {
    buffer[index + 3] = 0;
    return;
  }

  const mix = (channel: number, value: number) =>
    (value * sourceAlpha + buffer[index + channel] * destAlpha * (1 - sourceAlpha)) / outAlpha;

  buffer[index] = mix(0, source.r);
  buffer[index + 1] = mix(1, source.g);
  buffer[index + 2] = mix(2, source.b);
  buffer[index + 3] = outAlpha * 255;
}

export function cropRegion(
  buffer: PixelBuffer,
  width: number,
  rect: Rect,
): PixelBuffer {
  const out = new Uint8ClampedArray(rect.w * rect.h * BYTES_PER_PIXEL);
  const rowBytes = rect.w * BYTES_PER_PIXEL;
  for (let row = 0; row < rect.h; row++) {
    const from = bufferIndex(rect.x, rect.y + row, width);
    out.set(buffer.subarray(from, from + rowBytes), row * rowBytes);
  }
  return out;
}

export function pasteRegion(
  buffer: PixelBuffer,
  width: number,
  rect: Rect,
  region: PixelBuffer,
): void {
  const rowBytes = rect.w * BYTES_PER_PIXEL;
  for (let row = 0; row < rect.h; row++) {
    buffer.set(
      region.subarray(row * rowBytes, (row + 1) * rowBytes),
      bufferIndex(rect.x, rect.y + row, width),
    );
  }
}

export function clearRegion(buffer: PixelBuffer, width: number, rect: Rect): void {
  const rowBytes = rect.w * BYTES_PER_PIXEL;
  for (let row = 0; row < rect.h; row++) {
    const start = bufferIndex(rect.x, rect.y + row, width);
    buffer.fill(0, start, start + rowBytes);
  }
}

export function isBufferEmpty(buffer: PixelBuffer): boolean {
  for (let index = 3; index < buffer.length; index += BYTES_PER_PIXEL) {
    if (buffer[index] !== 0) return false;
  }
  return true;
}

export type AnchorX = "left" | "center" | "right";
export type AnchorY = "top" | "center" | "bottom";

export interface ResizeOptions {
  anchorX?: AnchorX;
  anchorY?: AnchorY;
}

export interface BufferSize {
  width: number;
  height: number;
}

/** Crops or pads the canvas. Pixels keep their values — this never resamples. */
export function resizeBuffer(
  buffer: PixelBuffer,
  from: BufferSize,
  to: BufferSize,
  options: ResizeOptions = {},
): PixelBuffer {
  const out = createBuffer(to.width, to.height);
  const offsetX = align(to.width - from.width, options.anchorX ?? "left");
  const offsetY = align(to.height - from.height, options.anchorY ?? "top");

  for (let y = 0; y < from.height; y++) {
    const targetY = y + offsetY;
    if (targetY < 0 || targetY >= to.height) continue;

    for (let x = 0; x < from.width; x++) {
      const targetX = x + offsetX;
      if (targetX < 0 || targetX >= to.width) continue;

      const source = bufferIndex(x, y, from.width);
      out.set(
        buffer.subarray(source, source + BYTES_PER_PIXEL),
        bufferIndex(targetX, targetY, to.width),
      );
    }
  }

  return out;
}

function align(delta: number, anchor: AnchorX | AnchorY): number {
  if (anchor === "center") return Math.floor(delta / 2);
  return anchor === "right" || anchor === "bottom" ? delta : 0;
}
