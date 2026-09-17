import {
  createRectSelection,
  liftRegion,
  stampRegion,
  type LiftedRegion,
  type Selection,
} from "@/editor/selection";
import { floatingPainter } from "@/editor/overlays/selectionOverlay";
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
  continuous: true,

  onPointerDown(_ctx, point) {
    drag = { origin: point, lifted: null, offset: { x: 0, y: 0 } };
    bridge.setPending({ x: point.x, y: point.y, w: 1, h: 1 });
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
    drag = null;
  },

  onCancel() {
    drag = null;
    bridge.setPending(null);
  },
};

export const moveTool: Tool = {
  id: "move",
  label: "Move selection",
  continuous: true,

  onPointerDown(ctx, point, modifiers) {
    const selection = bridge.get();
    if (!selection || !rectContains(selection.rect, point.x, point.y)) return;

    ctx.stroke.touch(ctx.layerId, ctx.frameId);
    // Alt copies: lift without cutting the source.
    const lifted = liftRegion(ctx.doc, ctx.layerId, ctx.frameId, selection, !modifiers.alt);
    if (!lifted) return;

    drag = { origin: point, lifted, offset: { x: 0, y: 0 } };
    // The floating preview below is the selection while it's moving; the static marching-ants
    // channel would otherwise keep showing the (now hollow) source rect underneath it.
    bridge.set(null);
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
    ctx.setOverlay(null);
    drag = null;
  },

  onCancel(ctx) {
    ctx.setOverlay(null);
    // onPointerDown cleared the selection for the floating preview's sake; a cancelled drag
    // never reached onPointerUp to restore it, so put it back at its original spot.
    if (drag?.lifted) bridge.set(createRectSelection(ctx.doc.width, ctx.doc.height, drag.lifted.rect));
    drag = null;
  },
};
