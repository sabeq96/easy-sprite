import { describe, expect, it } from "vitest";
import { GRID_MIN_SCALE } from "@/constants/canvas";
import { drawGrid } from "@/core/painters/grid";
import { drawOnion } from "@/core/painters/onion";
import type { PaintContext } from "@/core/renderer";
import { makeDocument } from "@test/factories";

type Call = [method: string, ...args: unknown[]];

/** A 2D context that records every method call, and the alpha each `drawImage` ran at. */
function recordingContext() {
  const calls: Call[] = [];
  const state = { globalAlpha: 1, lineWidth: 1, strokeStyle: "" };
  const record =
    (method: string) =>
    (...args: unknown[]) =>
      calls.push(method === "drawImage" ? [method, state.globalAlpha] : [method, ...args]);
  const ctx = Object.assign(state, {
    beginPath: record("beginPath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    stroke: record("stroke"),
    drawImage: record("drawImage"),
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, state, calls, count: (method: string) => calls.filter(([m]) => m === method).length };
}

function paintContext(
  ctx: CanvasRenderingContext2D,
  { scale = 10, frameId = "f1", width = 16, height = 8 } = {},
): PaintContext {
  const doc = makeDocument({ width, height, frames: [{ id: "f1" }, { id: "f2" }] });
  return { ctx, doc, frameId, viewport: { scale, originX: 0, originY: 0 }, isPlaying: false, dpr: 1 };
}

describe("drawGrid", () => {
  it("draws nothing when a cell would be smaller than GRID_MIN_SCALE on screen", () => {
    const recording = recordingContext();
    const scale = (GRID_MIN_SCALE - 1) / 4;
    drawGrid(paintContext(recording.ctx, { scale }), 4);
    expect(recording.calls).toEqual([]);
  });

  it("draws one line per cell boundary, edges included, in a single stroke", () => {
    const recording = recordingContext();
    drawGrid(paintContext(recording.ctx, { width: 16, height: 8 }), 4);
    expect(recording.count("moveTo")).toBe(16 / 4 + 1 + (8 / 4 + 1));
    expect(recording.count("lineTo")).toBe(8);
    expect(recording.count("stroke")).toBe(1);
  });
});

describe("drawOnion", () => {
  const opts = { direction: "before" as const, opacity: 0.35 };

  it("draws nothing at the first frame with 'before'", () => {
    const recording = recordingContext();
    drawOnion(paintContext(recording.ctx, { frameId: "f1" }), opts, new OffscreenCanvas(1, 1));
    expect(recording.calls).toEqual([]);
  });

  it("draws nothing at the last frame with 'after'", () => {
    const recording = recordingContext();
    const after = { ...opts, direction: "after" as const };
    drawOnion(paintContext(recording.ctx, { frameId: "f2" }), after, new OffscreenCanvas(1, 1));
    expect(recording.calls).toEqual([]);
  });

  it("ghosts the neighbouring frame once, at its opacity, and restores full alpha", () => {
    const recording = recordingContext();
    drawOnion(paintContext(recording.ctx, { frameId: "f2" }), opts, new OffscreenCanvas(1, 1));
    expect(recording.calls).toEqual([["drawImage", 0.35]]);
    expect(recording.state.globalAlpha).toBe(1);
  });
});
