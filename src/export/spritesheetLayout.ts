import type { SpritesheetLayout } from "@/constants/export";
import type { Rect } from "@/lib/rect";

export interface LayoutInput {
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  layout: SpritesheetLayout;
  /** Only used by the 'grid' layout. */
  columns?: number;
  scale: number;
  /** Transparent gutter between frames, in source pixels. */
  padding?: number;
  margin?: number;
}

export interface SheetLayout {
  width: number;
  height: number;
  columns: number;
  rows: number;
  /** Destination rect of each frame, in output pixels, in frame order. */
  frames: Rect[];
}

/** Squarish sheet — the friendliest default for engines that do not care about layout. */
function autoColumns(frameCount: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(frameCount)));
}

export function computeSheetLayout(input: LayoutInput): SheetLayout {
  const { frameCount, frameWidth, frameHeight, layout, scale } = input;
  const padding = (input.padding ?? 0) * scale;
  const margin = (input.margin ?? 0) * scale;
  const cellWidth = frameWidth * scale;
  const cellHeight = frameHeight * scale;

  const columns =
    layout === "horizontal"
      ? Math.max(1, frameCount)
      : layout === "vertical"
        ? 1
        : Math.max(1, Math.min(input.columns ?? autoColumns(frameCount), frameCount));

  const rows = Math.max(1, Math.ceil(frameCount / columns));

  const frames: Rect[] = Array.from({ length: frameCount }, (_, index) => ({
    x: margin + (index % columns) * (cellWidth + padding),
    y: margin + Math.floor(index / columns) * (cellHeight + padding),
    w: cellWidth,
    h: cellHeight,
  }));

  return {
    columns,
    rows,
    width: margin * 2 + columns * cellWidth + Math.max(0, columns - 1) * padding,
    height: margin * 2 + rows * cellHeight + Math.max(0, rows - 1) * padding,
    frames,
  };
}
