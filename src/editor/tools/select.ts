import {
  createRectSelection,
  liftRegion,
  stampRegion,
  type LiftedRegion,
  type Selection,
} from "@/editor/selection";
import { floatingPainter, marchingAntsPainter } from "@/editor/overlays/selectionOverlay";
import type { Tool, ToolPoint } from "@/editor/tools/types";
import { rectContains, rectFromPoints, rectUnion } from "@/lib/rect";

/**
 * The React-free core cannot read the store, so the editor injects accessors once.
 * Two functions, no coupling, and tools stay unit-testable with a fake bridge.
 */
export interface SelectionBridge {
  get(): Selection | null;
  set(selection: Selection | null): void;
  getPending(): { x: number; y: number; w: number; h: number } | null;
  setPending(rect: { x: number; y: number; w: number; h: number } | null): void;
}

let bridge: SelectionBridge = {
  get: () => null,
  set: () => {},
  getPending: () => null,
  setPending: () => {},
};

export function configureSelectionBridge(next: SelectionBridge): void {
  bridge = next;
}

/**
 * Per-drag state, scoped to this module: pointer capture guarantees only one stroke is
 * active at a time, so a single slot is safe.
 */
interface DragState {
  origin: ToolPoint;
  lifted: LiftedRegion | null;
  offset: { x: number; y: number };
}

let drag: DragState | null = null;

export const selectTool: Tool = {
  id: "select",
  label: "Select",
  cursor: "crosshair",
  continuous: true,

  onPointerDown(ctx, point) {
    drag = { origin: point, lifted: null, offset: { x: 0, y: 0 } };
    bridge.setPending({ x: point.x, y: point.y, w: 1, h: 1 });
    ctx.setOverlay(marchingAntsPainter(bridge.get, bridge.getPending), true);
  },

  onPointerMove(_ctx, point) {
    if (!drag) return;
    bridge.setPending(rectFromPoints(drag.origin.x, drag.origin.y, point.x, point.y));
  },

  onPointerUp(ctx, point) {
    if (!drag) return;

    const rect = rectFromPoints(drag.origin.x, drag.origin.y, point.x, point.y);
    // A click without a drag clears the selection — the standard "click to deselect".
    const selection =
      rect.w > 1 || rect.h > 1
        ? createRectSelection(ctx.doc.width, ctx.doc.height, rect)
        : null;

    bridge.set(selection);
    bridge.setPending(null);
    ctx.setOverlay(selection ? marchingAntsPainter(bridge.get, () => null) : null, true);
    drag = null;
  },

  onCancel(ctx) {
    drag = null;
    bridge.setPending(null);
    ctx.setOverlay(null);
  },
};

export const moveTool: Tool = {
  id: "move",
  label: "Move selection",
  cursor: "move",
  continuous: true,

  onPointerDown(ctx, point, modifiers) {
    const selection = bridge.get();
    if (!selection || !rectContains(selection.rect, point.x, point.y)) return;

    ctx.stroke.touch(ctx.layerId, ctx.frameId);
    // Alt copies: lift without cutting the source.
    const lifted = liftRegion(ctx.doc, ctx.layerId, ctx.frameId, selection, !modifiers.alt);
    if (!lifted) return;

    drag = { origin: point, lifted, offset: { x: 0, y: 0 } };
    ctx.setOverlay(
      floatingPainter(() => (drag?.lifted ? { region: drag.lifted, offset: drag.offset } : null)),
      true,
    );
  },

  onPointerMove(_ctx, point) {
    if (!drag?.lifted) return;
    drag.offset = { x: point.x - drag.origin.x, y: point.y - drag.origin.y };
  },

  onPointerUp(ctx) {
    if (!drag?.lifted) {
      drag = null;
      return;
    }

    const { lifted, offset } = drag;
    const target = { x: lifted.rect.x + offset.x, y: lifted.rect.y + offset.y };
    const written = stampRegion(ctx.doc, ctx.layerId, ctx.frameId, lifted, target);

    // The stroke covers both the lift and the drop, so one drag is one undo step.
    if (written) ctx.stroke.extend(ctx.layerId, ctx.frameId, rectUnion(lifted.rect, written));

    // The selection follows the pixels.
    const moved = createRectSelection(ctx.doc.width, ctx.doc.height, {
      ...lifted.rect,
      x: target.x,
      y: target.y,
    });
    bridge.set(moved);
    ctx.setOverlay(moved ? marchingAntsPainter(bridge.get, () => null) : null, true);
    drag = null;
  },

  onCancel(ctx) {
    ctx.setOverlay(null);
    drag = null;
  },
};
