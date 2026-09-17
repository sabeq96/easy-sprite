import { describe, expect, it } from "vitest";
import { computeSheetLayout } from "@/export/spritesheetLayout";

describe("spritesheet layout", () => {
  it("lays frames in a horizontal strip", () => {
    const layout = computeSheetLayout({
      frameCount: 4,
      frameWidth: 16,
      frameHeight: 16,
      layout: "horizontal",
      scale: 1,
    });

    expect(layout).toMatchObject({ columns: 4, rows: 1, width: 64, height: 16 });
    expect(layout.frames[3]).toEqual({ x: 48, y: 0, w: 16, h: 16 });
  });

  it("lays frames in a vertical strip", () => {
    const layout = computeSheetLayout({
      frameCount: 3,
      frameWidth: 8,
      frameHeight: 8,
      layout: "vertical",
      scale: 1,
    });

    expect(layout).toMatchObject({ columns: 1, rows: 3, width: 8, height: 24 });
  });

  it("lays 7 frames of 16px into a 3-column grid with 1px padding", () => {
    const layout = computeSheetLayout({
      frameCount: 7,
      frameWidth: 16,
      frameHeight: 16,
      layout: "grid",
      columns: 3,
      scale: 1,
      padding: 1,
    });

    expect(layout).toMatchObject({ columns: 3, rows: 3, width: 50, height: 50 });
    expect(layout.frames[3]).toEqual({ x: 0, y: 17, w: 16, h: 16 });
  });

  it("scales every dimension including padding and margin", () => {
    const layout = computeSheetLayout({
      frameCount: 2,
      frameWidth: 8,
      frameHeight: 8,
      layout: "horizontal",
      scale: 4,
      padding: 1,
      margin: 2,
    });

    // margin and padding scale with the frames: 2*(2*4) + 2*(8*4) + 1*(1*4)
    expect(layout.width).toBe(16 + 64 + 4);
    expect(layout.frames[1].x).toBe(8 + 32 + 4);
    expect(layout.frames[0].w).toBe(32);
  });

  it("picks a squarish grid when no column count is given", () => {
    const layout = computeSheetLayout({
      frameCount: 9,
      frameWidth: 8,
      frameHeight: 8,
      layout: "grid",
      scale: 1,
    });

    expect(layout).toMatchObject({ columns: 3, rows: 3 });
  });

  it("never produces zero columns or rows for a single frame", () => {
    const layout = computeSheetLayout({
      frameCount: 1,
      frameWidth: 8,
      frameHeight: 8,
      layout: "grid",
      scale: 1,
    });

    expect(layout).toMatchObject({ columns: 1, rows: 1, width: 8, height: 8 });
  });
});
