import { BRUSH_SIZES, DEFAULT_BRUSH_SIZE } from "@/constants/tools";
import type { Point } from "@/core/viewport";
import type { ToolHost } from "@/framework/host";
import { choice, type ChoiceSetting, type Settings } from "@/framework/settings";
import { brushCursorPainter } from "./brushCursor";

/** A brush size setting. Each tool that declares one remembers its own size. */
export function brushSize(): ChoiceSetting<number> {
  return choice({
    label: "Brush size",
    values: BRUSH_SIZES,
    default: DEFAULT_BRUSH_SIZE,
    unit: "pixels",
  });
}

/** What the preview needs from the tool's settings; a tool without mirror leaves it out. */
export interface BrushShape {
  size: number;
  mirrorHorizontal?: boolean;
  mirrorVertical?: boolean;
}

/** The footprint a brush tool would paint under the pointer, drawn on the tool's overlay. */
export interface BrushPreview<S extends Settings = Settings> {
  /** Installs the preview for as long as the tool is active; the cleanup removes it. */
  activate(host: ToolHost<S>): () => void;
  /** The pixel under the pointer, or null once it leaves. Repaints only when it changes. */
  move(point: Point | null): void;
}

/** `read` is called at paint time, so a changed setting shows on the next repaint. */
export function createBrushPreview<S extends Settings>(
  read: (host: ToolHost<S>) => BrushShape,
): BrushPreview<S> {
  let host: ToolHost<S> | null = null;
  let point: Point | null = null;

  const painter = brushCursorPainter(() => {
    if (!host || !point) return null;
    const shape = read(host);
    return {
      point,
      size: shape.size,
      mirrorHorizontal: shape.mirrorHorizontal ?? false,
      mirrorVertical: shape.mirrorVertical ?? false,
      sprite: { width: host.document.width, height: host.document.height },
    };
  });

  return {
    activate(next) {
      host = next;
      point = null;
      next.canvas.setOverlay(painter);
      return () => {
        next.canvas.setOverlay(null);
        host = null;
        point = null;
      };
    },
    move(next) {
      if (next?.x === point?.x && next?.y === point?.y) return;
      point = next;
      host?.canvas.requestRender();
    },
  };
}
