import { describe, expect, it, vi } from "vitest";
import type { OverlayPaint } from "@/framework/host";
import { brushSize, createBrushPreview } from "@/tools/shared/brush";
import { fakeHost } from "@test/factories";

const VIEWPORT = { scale: 10, originX: 0, originY: 0 };

function fakeContext() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
  } as unknown as CanvasRenderingContext2D & { fillRect: ReturnType<typeof vi.fn> };
}

function setup(shape: { size: number; mirrorHorizontal?: boolean }) {
  const host = fakeHost();
  const preview = createBrushPreview(() => shape);
  const stop = preview.activate(host);
  const paint = vi.mocked(host.canvas.setOverlay).mock.calls[0][0] as OverlayPaint;
  const ctx = fakeContext();
  const context = { ctx, viewport: VIEWPORT, frameId: "f1", isPlaying: false, dpr: 1 };
  return { host, preview, stop, paint: () => paint(context), ctx };
}

describe("brushSize", () => {
  it("is a choice labelled Brush size, from 1 to 8, defaulting to 1", () => {
    expect(brushSize()).toMatchObject({
      kind: "choice",
      label: "Brush size",
      values: [1, 2, 3, 4, 6, 8],
      default: 1,
      unit: "pixels",
    });
  });
});

describe("createBrushPreview", () => {
  it("draws nothing until the pointer is over the sprite", () => {
    const { paint, ctx } = setup({ size: 1 });
    paint();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("repaints when the pointer moves to another pixel, and only then", () => {
    const { host, preview } = setup({ size: 1 });

    preview.move({ x: 1, y: 1 });
    preview.move({ x: 1, y: 1 });
    preview.move({ x: 2, y: 1 });

    expect(host.canvas.requestRender).toHaveBeenCalledTimes(2);
  });

  it("draws the footprint, plus a mirrored copy only when the tool reads mirror on", () => {
    const plain = setup({ size: 2 });
    plain.preview.move({ x: 0, y: 0 });
    plain.paint();
    expect(plain.ctx.fillRect.mock.calls).toEqual([[0, 0, 20, 20]]);

    const mirrored = setup({ size: 1, mirrorHorizontal: true });
    mirrored.preview.move({ x: 0, y: 1 });
    mirrored.paint();
    expect(mirrored.ctx.fillRect.mock.calls).toEqual([
      [0, 10, 10, 10],
      [30, 10, 10, 10],
    ]);
  });

  it("hides once the pointer leaves the sprite", () => {
    const { preview, paint, ctx } = setup({ size: 1 });
    preview.move({ x: 9, y: 9 });
    paint();
    preview.move(null);
    paint();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("removes its overlay on deactivation and forgets the pointer", () => {
    const { host, preview, stop, paint, ctx } = setup({ size: 1 });
    preview.move({ x: 1, y: 1 });

    stop();
    paint();

    expect(host.canvas.setOverlay).toHaveBeenLastCalledWith(null);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});
