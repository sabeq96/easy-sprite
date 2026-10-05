import { describe, expect, it } from "vitest";
import { selectionFromPath, selectionFromRect, isSelected, type Selection } from "@/tools/select/selection";

/** The selection as rows of "#" and ".", over its own bounding box. */
function draw(selection: Selection | null): string[] {
  if (!selection) return [];
  const rows: string[] = [];
  for (let y = 0; y < selection.rect.h; y++) {
    let row = "";
    for (let x = 0; x < selection.rect.w; x++) row += isSelected(selection, selection.rect.x + x, selection.rect.y + y) ? "#" : ".";
    rows.push(row);
  }
  return rows;
}

const pts = (...coords: [number, number][]) => coords.map(([x, y]) => ({ x, y }));

describe("selectionFromRect", () => {
  it("is fully set and clamped to the canvas", () => {
    const selection = selectionFromRect({ x: -1, y: 2, w: 3, h: 5 }, 4, 4)!;
    expect(selection.rect).toEqual({ x: 0, y: 2, w: 2, h: 2 });
    expect(draw(selection)).toEqual(["##", "##"]);
  });

  it("is null when nothing is on the canvas", () => {
    expect(selectionFromRect({ x: 9, y: 9, w: 2, h: 2 }, 4, 4)).toBeNull();
  });
});

describe("selectionFromPath", () => {
  it("makes one pixel from a single point", () => {
    expect(selectionFromPath(pts([2, 1]), 4, 4)!.rect).toEqual({ x: 2, y: 1, w: 1, h: 1 });
  });

  it("joins skipped pixels with a line and closes back to the start", () => {
    const selection = selectionFromPath(pts([0, 0], [3, 0]), 8, 8);
    expect(draw(selection)).toEqual(["####"]);
  });

  it("fills the inside of the closed path", () => {
    const selection = selectionFromPath(pts([0, 0], [4, 0], [4, 4], [0, 4]), 8, 8);
    expect(draw(selection)).toEqual(["#####", "#####", "#####", "#####", "#####"]);
  });

  it("fills a triangle, closing it with a straight line", () => {
    const selection = selectionFromPath(pts([0, 0], [4, 0], [0, 4]), 8, 8);
    expect(draw(selection)).toEqual(["#####", "####.", "###..", "##...", "#...."]);
  });

  it("leaves the overlap of a self-crossing path unselected", () => {
    // A bow-tie traced as a figure-eight: the crossing point is outline, the lobes are filled.
    const selection = selectionFromPath(pts([0, 0], [6, 6], [6, 0], [0, 6]), 8, 8)!;
    expect(isSelected(selection, 1, 3)).toBe(true);
    expect(isSelected(selection, 5, 3)).toBe(true);
    expect(isSelected(selection, 3, 1)).toBe(false);
    expect(isSelected(selection, 3, 5)).toBe(false);
  });

  it("clamps to the canvas and trims to the tight box", () => {
    const selection = selectionFromPath(pts([-3, 1], [2, 1], [2, 2], [-3, 2]), 4, 4)!;
    expect(selection.rect).toEqual({ x: 0, y: 1, w: 3, h: 2 });
  });

  it("is null when drawn entirely off the canvas", () => {
    expect(selectionFromPath(pts([-5, -5], [-2, -2]), 4, 4)).toBeNull();
  });
});
