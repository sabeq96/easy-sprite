import { SquareDashed } from "lucide-react";
import { clearRegion, cropRegion, pasteRegion } from "@/core/buffer";
import type { Surface, ToolHost } from "@/framework/host";
import { defineTool, type ToolPoint } from "@/framework/tool";
import {
  rectClamp,
  rectContains,
  rectFromPoints,
  rectIsEmpty,
  rectUnion,
  type Rect,
} from "@/lib/rect";
import { getClipboard, hasClipboard, pasteRect, setClipboard } from "./clipboard";
import { selectionPainter, type SelectionView } from "./overlay";
import { liftRegion, stampRegion, type LiftedRegion, type PixelGrid } from "./region";

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
  /** The gesture's surface, pinned at press so the drop lands where the lift came from. */
  surface: Surface;
  /** Lifted on the first pixel of movement, so a click inside the selection is a no-op. */
  lifted: LiftedRegion | null;
  offset: { x: number; y: number };
}

/**
 * Everything the tool knows. `host` is non-null exactly between onActivate and its cleanup,
 * and the cleanup resets the rest: a selection cannot outlive the tool. Pointer capture means
 * only one gesture runs at a time, so module scope is safe.
 */
const state = {
  host: null as ToolHost | null,
  rect: null as Rect | null,
  drag: null as MarqueeDrag | MoveDrag | null,
  hover: null as ToolPoint | null,
};

function clampTo(host: ToolHost, rect: Rect): Rect | null {
  const clamped = rectClamp(rect, host.document.width, host.document.height);
  return rectIsEmpty(clamped) ? null : clamped;
}

function isOverSelection(point: ToolPoint | null): boolean {
  return !!point && !!state.rect && rectContains(state.rect, point.x, point.y);
}

function hasSelection(): boolean {
  return state.rect !== null;
}

function changed(): void {
  state.host?.canvas.requestRender();
}

/** Ignored while the tool is inactive, so commands activate the tool first. */
function setSelection(rect: Rect | null): void {
  if (!state.host) return;
  state.rect = rect && clampTo(state.host, rect);
  changed();
}

/** Read-only, for tests: the host reaches the selection only through this tool's commands. */
export function selectedRect(): Rect | null {
  return state.rect;
}

function gridOf(surface: Surface): PixelGrid {
  return { pixels: surface.buffer(), width: surface.width, height: surface.height };
}

function view(): SelectionView | null {
  const { host, drag, hover } = state;
  if (!host) return null;

  if (drag?.kind === "marquee") {
    return { rect: clampTo(host, drag.rect), floating: null, hover: null };
  }

  if (drag?.kind === "move" && drag.lifted) {
    const { lifted, offset } = drag;
    const moved = { ...lifted.rect, x: lifted.rect.x + offset.x, y: lifted.rect.y + offset.y };
    return { rect: clampTo(host, moved), floating: { region: lifted, offset }, hover: null };
  }

  const { width, height } = host.document;
  const inSprite =
    hover !== null && hover.x >= 0 && hover.y >= 0 && hover.x < width && hover.y < height;
  return {
    rect: state.rect,
    floating: null,
    hover: inSprite && !isOverSelection(hover) ? hover : null,
  };
}

/** A tool switch mid-drag must not lose the cut pixels: put back everything the drag changed. */
function abandonDrag(): void {
  if (state.drag?.kind === "move") state.drag.surface.revert();
  state.drag = null;
}

/** Clears the selected pixels as one undo step; `cut` copies them to the clipboard first. */
function clearSelection(host: ToolHost, label: string, cut: boolean): void {
  const rect = state.rect;
  if (!rect) return;
  host.history.edit(label, (surface) => {
    const { pixels, width } = gridOf(surface);
    if (cut) setClipboard({ rect, pixels: cropRegion(pixels, width, rect) });
    clearRegion(pixels, width, rect);
    surface.commit(rect);
  });
}

export const selectTool = defineTool({
  id: "select",
  label: "Select & move",
  icon: SquareDashed,
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
    {
      id: "edit.selectAll",
      label: "Select all",
      group: "Edit",
      keys: [{ key: "a", mod: true }],
      run(host: ToolHost) {
        host.tool.activate();
        setSelection({ x: 0, y: 0, w: host.document.width, h: host.document.height });
      },
    },
    {
      id: "edit.deselect",
      label: "Deselect",
      group: "Edit",
      keys: [{ key: "escape" }],
      isEnabled: hasSelection,
      run: () => setSelection(null),
    },
    {
      id: "edit.copy",
      label: "Copy",
      group: "Edit",
      keys: [{ key: "c", mod: true }],
      isEnabled: hasSelection,
      run(host: ToolHost) {
        const rect = state.rect;
        const pixels = rect && host.document.crop(rect);
        if (rect && pixels) setClipboard({ rect, pixels });
      },
    },
    {
      id: "edit.cut",
      label: "Cut",
      group: "Edit",
      keys: [{ key: "x", mod: true }],
      isEnabled: hasSelection,
      run: (host: ToolHost) => clearSelection(host, "Cut", true),
    },
    {
      id: "edit.paste",
      label: "Paste",
      group: "Edit",
      keys: [{ key: "v", mod: true }],
      isEnabled: hasClipboard,
      run(host: ToolHost) {
        const clip = getClipboard();
        if (!clip) return;

        const pasted = { rect: null as Rect | null };
        const editable = host.history.edit("Paste", (surface) => {
          pasted.rect = pasteRect(clip, surface.width, surface.height);
          if (!pasted.rect) return;
          pasteRegion(surface.buffer(), surface.width, pasted.rect, clip.pixels);
          surface.commit(pasted.rect);
        });
        if (!editable || !pasted.rect) return;

        // Select what was just pasted, so it can be dragged straight away.
        host.tool.activate();
        setSelection(pasted.rect);
      },
    },
    {
      id: "edit.deleteSelection",
      label: "Delete selection",
      group: "Edit",
      keys: [{ key: "delete" }, { key: "backspace" }],
      isEnabled: hasSelection,
      run: (host: ToolHost) => clearSelection(host, "Delete", false),
    },
  ],
  continuous: true,
  options: [],

  onActivate(host) {
    state.host = host;
    host.canvas.setOverlay(selectionPainter(view));

    // The rect is geometry over the old canvas — meaningless after a resize.
    const offResize = host.document.onResize(() => setSelection(null));
    // Undo/redo moves pixels out from under the rect; the tool's own edits don't count.
    const offUndoRedo = host.history.onUndoRedo(() => setSelection(null));

    return () => {
      offResize();
      offUndoRedo();
      abandonDrag();
      state.host = null;
      state.rect = null;
      state.hover = null;
    };
  },

  onHover(_host, point) {
    state.hover = point;
    changed();
    return isOverSelection(point) ? "grab" : null;
  },

  onPointerDown(_host, { point, modifiers, surface }) {
    state.hover = null;
    if (isOverSelection(point)) {
      state.drag = {
        kind: "move",
        origin: point,
        copy: modifiers.ctrl,
        surface,
        lifted: null,
        offset: { x: 0, y: 0 },
      };
    } else {
      state.rect = null;
      state.drag = { kind: "marquee", origin: point, rect: rectFromPoints(point.x, point.y, point.x, point.y) };
    }
    changed();
  },

  onPointerMove(_host, { point }) {
    const drag = state.drag;
    if (!drag) return;

    if (drag.kind === "marquee") {
      drag.rect = rectFromPoints(drag.origin.x, drag.origin.y, point.x, point.y);
    } else if (state.rect) {
      if (!drag.lifted) {
        // An empty layer still lifts (transparent) so the selection can move.
        drag.lifted = liftRegion(gridOf(drag.surface), state.rect, !drag.copy);
        if (!drag.copy) drag.surface.commit(state.rect);
      }
      drag.offset = { x: point.x - drag.origin.x, y: point.y - drag.origin.y };
    }
    changed();
  },

  onPointerUp(host) {
    const drag = state.drag;
    state.drag = null;
    if (!drag) return;

    if (drag.kind === "marquee") {
      // A click is a 1×1 marquee: one pixel. Entirely off-canvas selects nothing.
      state.rect = clampTo(host, drag.rect);
    } else if (drag.lifted) {
      const { lifted, offset, surface } = drag;
      const target = { x: lifted.rect.x + offset.x, y: lifted.rect.y + offset.y };
      const written = stampRegion(gridOf(surface), lifted, target);
      // Lift + drop share the gesture: one drag, one undo step (even when dropped off-canvas).
      surface.commit(rectUnion(written, lifted.rect));
      // The selection follows the pixels.
      state.rect = clampTo(host, { ...lifted.rect, ...target });
    }
    changed();
  },
});
