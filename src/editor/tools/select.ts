import type { SpriteDocument } from "@/editor/document";
import { selectionPainter, type SelectionView } from "@/editor/overlays/selectionOverlay";
import { liftRegion, stampRegion, type LiftedRegion } from "@/editor/selection";
import { defineTool, type ToolPoint, type ToolSession } from "@/editor/tools/types";
import {
  rectClamp,
  rectContains,
  rectFromPoints,
  rectIsEmpty,
  rectUnion,
  type Rect,
} from "@/lib/rect";

interface MarqueeDrag {
  kind: "marquee";
  origin: ToolPoint;
  rect: Rect;
}

interface MoveDrag {
  kind: "move";
  origin: ToolPoint;
  /** Ctrl/⌘ held at press: duplicate instead of cutting. */
  copy: boolean;
  layerId: string;
  frameId: string;
  /** Lifted on the first pixel of movement, so a click inside the selection is a no-op. */
  lifted: LiftedRegion | null;
  offset: { x: number; y: number };
}

/**
 * Everything the tool knows. `session` is non-null exactly between onActivate and its cleanup,
 * and the cleanup resets the rest: a selection cannot outlive the tool. Pointer capture means
 * only one gesture runs at a time, so module scope is safe.
 */
const state = {
  session: null as ToolSession | null,
  rect: null as Rect | null,
  drag: null as MarqueeDrag | MoveDrag | null,
  hover: null as ToolPoint | null,
};

function clampTo(doc: SpriteDocument, rect: Rect): Rect | null {
  const clamped = rectClamp(rect, doc.width, doc.height);
  return rectIsEmpty(clamped) ? null : clamped;
}

function isOverSelection(point: ToolPoint | null): boolean {
  return !!point && !!state.rect && rectContains(state.rect, point.x, point.y);
}

function changed(): void {
  state.session?.requestRender();
}

/**
 * The tool's public face — the only way commands (copy, cut, delete, select all, paste) reach
 * the selection. Writes are ignored while the tool is inactive, so callers switch tools first.
 */
export const selection = {
  get: (): Rect | null => state.rect,
  set(rect: Rect | null): void {
    if (!state.session) return;
    state.rect = rect && clampTo(state.session.doc, rect);
    changed();
  },
  clear(): void {
    selection.set(null);
  },
};

function view(): SelectionView | null {
  const { session, drag, hover } = state;
  if (!session) return null;
  const { doc } = session;

  if (drag?.kind === "marquee") {
    return { rect: clampTo(doc, drag.rect), floating: null, hover: null };
  }

  if (drag?.kind === "move" && drag.lifted) {
    const { lifted, offset } = drag;
    const moved = { ...lifted.rect, x: lifted.rect.x + offset.x, y: lifted.rect.y + offset.y };
    return { rect: clampTo(doc, moved), floating: { region: lifted, offset }, hover: null };
  }

  const inSprite =
    hover !== null && hover.x >= 0 && hover.y >= 0 && hover.x < doc.width && hover.y < doc.height;
  return {
    rect: state.rect,
    floating: null,
    hover: inSprite && !isOverSelection(hover) ? hover : null,
  };
}

/** A tool switch mid-drag must not lose the cut pixels: put them back where they came from. */
function abandonDrag(doc: SpriteDocument): void {
  const drag = state.drag;
  // The cut left the rect transparent, so stamping only opaque pixels restores it exactly.
  if (drag?.kind === "move" && drag.lifted && !drag.copy) {
    stampRegion(doc, drag.layerId, drag.frameId, drag.lifted, drag.lifted.rect);
  }
  state.drag = null;
}

export const selectTool = defineTool({
  id: "select",
  label: "Select & move",
  group: "select",
  shortcut: { key: "s" },
  // `mod`: the move gesture reads `modifiers.ctrl`, which is Ctrl or ⌘.
  hints: [
    {
      action: "Duplicate selection",
      inputs: [{ hold: "mod" }, { pointer: "drag" }],
      where: "inside selection",
    },
  ],
  commands: [
    "edit.selectAll",
    "edit.deselect",
    "edit.copy",
    "edit.cut",
    "edit.paste",
    "edit.deleteSelection",
  ],
  continuous: true,
  options: [],

  onActivate(session) {
    state.session = session;
    session.setOverlay(selectionPainter(view));

    let { width, height } = session.doc;
    // The rect is geometry over the old canvas — meaningless after a resize.
    const offMeta = session.doc.events.on("meta", () => {
      if (session.doc.width === width && session.doc.height === height) return;
      ({ width, height } = session.doc);
      selection.clear();
    });
    // Undo/redo moves pixels out from under the rect. Our own moves arrive as "push".
    const offHistory = session.history.events.on("change", (kind) => {
      if (kind !== "push") selection.clear();
    });

    return () => {
      offMeta();
      offHistory();
      abandonDrag(session.doc);
      state.session = null;
      state.rect = null;
      state.hover = null;
    };
  },

  onHover(point) {
    state.hover = point;
    changed();
    return isOverSelection(point) ? "grab" : null;
  },

  onPointerDown(ctx, point, modifiers) {
    state.hover = null;
    if (isOverSelection(point)) {
      state.drag = {
        kind: "move",
        origin: point,
        copy: modifiers.ctrl,
        layerId: ctx.layerId,
        frameId: ctx.frameId,
        lifted: null,
        offset: { x: 0, y: 0 },
      };
    } else {
      state.rect = null;
      state.drag = { kind: "marquee", origin: point, rect: rectFromPoints(point.x, point.y, point.x, point.y) };
    }
    changed();
  },

  onPointerMove(ctx, point) {
    const drag = state.drag;
    if (!drag) return;

    if (drag.kind === "marquee") {
      drag.rect = rectFromPoints(drag.origin.x, drag.origin.y, point.x, point.y);
    } else if (state.rect) {
      if (!drag.lifted) {
        ctx.stroke.touch(ctx.layerId, ctx.frameId);
        drag.lifted = liftRegion(ctx.doc, ctx.layerId, ctx.frameId, state.rect, !drag.copy);
      }
      drag.offset = { x: point.x - drag.origin.x, y: point.y - drag.origin.y };
    }
    changed();
  },

  onPointerUp(ctx) {
    const drag = state.drag;
    state.drag = null;
    if (!drag) return;

    if (drag.kind === "marquee") {
      // A click is a 1×1 marquee: one pixel. Entirely off-canvas selects nothing.
      state.rect = clampTo(ctx.doc, drag.rect);
    } else if (drag.lifted) {
      const { lifted, offset } = drag;
      const target = { x: lifted.rect.x + offset.x, y: lifted.rect.y + offset.y };
      const written = stampRegion(ctx.doc, ctx.layerId, ctx.frameId, lifted, target);
      // Lift + drop share the stroke: one drag, one undo step (even when dropped off-canvas).
      ctx.stroke.extend(ctx.layerId, ctx.frameId, rectUnion(written, lifted.rect));
      // The selection follows the pixels.
      state.rect = clampTo(ctx.doc, { ...lifted.rect, ...target });
    }
    changed();
  },
});
