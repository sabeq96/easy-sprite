import { describe, expect, it } from "vitest";
import {
  blendPixel,
  clearRegion,
  createBuffer,
  cropRegion,
  getPixel,
  isBufferEmpty,
  pasteRegion,
  resizeBuffer,
  setPixel,
} from "@/editor/buffer";

describe("buffer primitives", () => {
  it("sets and reads a pixel", () => {
    const buffer = createBuffer(2, 2);
    setPixel(buffer, 1, 1, 2, { r: 1, g: 2, b: 3, a: 4 });
    expect(getPixel(buffer, 1, 1, 2)).toEqual({ r: 1, g: 2, b: 3, a: 4 });
    expect(getPixel(buffer, 0, 0, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it("replaces rather than blends for an opaque source", () => {
    const buffer = createBuffer(1, 1);
    setPixel(buffer, 0, 0, 1, { r: 255, g: 0, b: 0, a: 255 });
    blendPixel(buffer, 0, 0, 1, { r: 0, g: 0, b: 255, a: 255 });
    expect(getPixel(buffer, 0, 0, 1)).toEqual({ r: 0, g: 0, b: 255, a: 255 });
  });

  it("blends a half-transparent source over an opaque destination", () => {
    const buffer = createBuffer(1, 1);
    setPixel(buffer, 0, 0, 1, { r: 0, g: 0, b: 0, a: 255 });
    blendPixel(buffer, 0, 0, 1, { r: 255, g: 255, b: 255, a: 128 });

    const result = getPixel(buffer, 0, 0, 1);
    expect(result.a).toBe(255);
    expect(result.r).toBeGreaterThan(120);
    expect(result.r).toBeLessThan(135);
  });

  it("leaves the destination untouched for a fully transparent source", () => {
    const buffer = createBuffer(1, 1);
    setPixel(buffer, 0, 0, 1, { r: 9, g: 9, b: 9, a: 255 });
    blendPixel(buffer, 0, 0, 1, { r: 0, g: 0, b: 0, a: 0 });
    expect(getPixel(buffer, 0, 0, 1)).toEqual({ r: 9, g: 9, b: 9, a: 255 });
  });

  it("crops and pastes a region round-trip", () => {
    const buffer = createBuffer(4, 4);
    setPixel(buffer, 1, 1, 4, { r: 10, g: 20, b: 30, a: 255 });
    setPixel(buffer, 2, 2, 4, { r: 40, g: 50, b: 60, a: 255 });

    const rect = { x: 1, y: 1, w: 2, h: 2 };
    const region = cropRegion(buffer, 4, rect);
    clearRegion(buffer, 4, rect);
    expect(isBufferEmpty(buffer)).toBe(true);

    pasteRegion(buffer, 4, rect, region);
    expect(getPixel(buffer, 1, 1, 4)).toEqual({ r: 10, g: 20, b: 30, a: 255 });
    expect(getPixel(buffer, 2, 2, 4)).toEqual({ r: 40, g: 50, b: 60, a: 255 });
  });

  it("pads on grow and crops on shrink, honouring the anchor", () => {
    const buffer = createBuffer(2, 2);
    setPixel(buffer, 0, 0, 2, { r: 255, g: 0, b: 0, a: 255 });

    const grown = resizeBuffer(buffer, { width: 2, height: 2 }, { width: 4, height: 4 });
    expect(getPixel(grown, 0, 0, 4).r).toBe(255);

    const centred = resizeBuffer(
      buffer,
      { width: 2, height: 2 },
      { width: 4, height: 4 },
      { anchorX: "center", anchorY: "center" },
    );
    expect(getPixel(centred, 1, 1, 4).r).toBe(255);

    const shrunk = resizeBuffer(buffer, { width: 2, height: 2 }, { width: 1, height: 1 });
    expect(shrunk.length).toBe(4);
    expect(getPixel(shrunk, 0, 0, 1).r).toBe(255);
  });
});
