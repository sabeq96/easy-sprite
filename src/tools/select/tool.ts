import { SquareDashed } from "lucide-react";
import { cropRegion } from "@/core/buffer";
import type { Surface, ToolHost } from "@/framework/host";
import { choice } from "@/framework/settings";
import { defineTool, type ToolPoint } from "@/framework/tool";
import { rectFromPoints, rectUnion, type Rect } from "@/lib/rect";
import { getClipboard, hasClipboard, pasteRect, setClipboard } from "./clipboard";
import { selectionPainter, type SelectionView } from "./overlay";
import {
  maskClamped,
  maskFromPath,
  maskFromRect,
  maskHas,
  maskMoved,
  type Mask,
} from "./mask";
import {
  clearMasked,
  eraseOutside,
  liftRegion,
  pasteMasked,
  stampRegion,
  type FloatingSelection,
  type PixelGrid,
} from "./region";

const settings = {
  shape: choice({
    label: "Shape",
    values: ["rectangle", "lasso"],
    default: "rectangle",
    labels: { rectangle: "Rectangle", lasso: "Lasso" },
  }),
};

interface MarqueeDrag {
  kind: "marquee";
  origin: ToolPoint;
  rect: Rect;
}

interface LassoDrag {
  kind: "lasso";
  /** Every pixel the pointer reported, in order. */
  path: ToolPoint[];
  /** What the path selects so far, for the live preview. */
  mask: Mask | null;
}

interface MoveDrag {
  kind: "move";
  origin: ToolPoint;
  /** Ctrl/⌘ held at press: duplicate instead of cutting. */
  copy: boolean;
  /** The gesture's surface, pinned at press so the drop lands where the lift came from. */
  surface: Surface;
  /** Lifted on the first pixel of movement, so a click inside the selection is a no-op. */
  floating: FloatingSelection | null;
  offset: { x: number; y: number };
}

/**
 * Everything the tool knows. `host` is non-null exactly between onActivate and its cleanup,
 * and the cleanup resets the rest: a selection cannot outlive the tool. Pointer capture means
 * only one gesture runs at a time, so module scope is safe.
 */
const state = {
  host: null as ToolHost | null,
  mask: null as Mask | null,
  drag: null as MarqueeDrag | LassoDrag | MoveDrag | null,
  hover: null as ToolPoint | null,
};

function isOverSelection(point: ToolPoint | null): boolean {
  return !!point && !!state.mask && maskHas(state.mask, point.x, point.y);
}

function hasSelection(): boolean {
  return state.mask !== null;
}

function changed(): void {
  state.host?.canvas.requestRender();
}

/** Ignored while the tool is inactive, so commands activate the tool first. */
function setSelection(mask: Mask | null): void {
  if (!state.host) return;
  state.mask = mask;
  changed();
}

/** Read-only, for tests: the host reaches the selection only through this tool's commands. */
export function selectedRect(): Rect | null {
  return state.mask?.rect ?? null;
}

/** Read-only, for tests: the selection's bounds and which pixels in them are selected. */
export function selectedMask(): Mask | null {
  return state.mask;
}

function gridOf(surface: Surface): PixelGrid {
  return { pixels: surface.buffer(), width: surface.width, height: surface.height };
}

function view(): SelectionView | null {
  const { host, drag, hover } = state;
  if (!host) return null;
  const { width, height } = host.document;

  if (drag?.kind === "marquee") {
    return { mask: maskFromRect(drag.rect, width, height), floating: null, hover: null };
  }

  if (drag?.kind === "lasso") return { mask: drag.mask, floating: null, hover: null };

  if (drag?.kind === "move" && drag.floating) {
    const { floating, offset } = drag;
    const moved = maskMoved(floating.mask, floating.rect.x + offset.x, floating.rect.y + offset.y);
    return {
      mask: maskClamped(moved, width, height),
      floating: { region: floating, offset },
      hover: null,
    };
  }

  const inSprite = hover !== null && hover.x >= 0 && hover.y >= 0 && hover.x < width && hover.y < height;
  return {
    mask: state.mask,
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
  const mask = state.mask;
  if (!mask) return;
  host.history.edit(label, (surface) => {
    const { pixels, width } = gridOf(surface);
    if (cut) {
      const copied = eraseOutside(cropRegion(pixels, width, mask.rect), mask);
      setClipboard({ rect: mask.rect, mask, pixels: copied });
    }
    clearMasked(pixels, width, mask);
    surface.commit(mask.rect);
  });
}

export const selectTool = defineTool({
  id: "select",
  label: "Select & move",
  icon: SquareDashed,
  group: "select",
  shortcut: { key: "s" },
  settings,
  reselect: "shape",
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
        setSelection(maskFromRect({ x: 0, y: 0, w: host.document.width, h: host.document.height }, host.document.width, host.document.height));
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
        const mask = state.mask;
        const pixels = mask && host.document.crop(mask.rect);
        if (mask && pixels) setClipboard({ rect: mask.rect, mask, pixels: eraseOutside(pixels, mask) });
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

        const pasted = { mask: null as Mask | null };
        const editable = host.history.edit("Paste", (surface) => {
          const rect = pasteRect(clip, surface.width, surface.height);
          if (!rect) return;
          pasted.mask = maskMoved(clip.mask, rect.x, rect.y);
          pasteMasked(surface.buffer(), surface.width, pasted.mask, clip.pixels);
          surface.commit(rect);
        });
        if (!editable || !pasted.mask) return;

        // Select what was just pasted, so it can be dragged straight away.
        host.tool.activate();
        setSelection(pasted.mask);
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

  onActivate(host) {
    state.host = host;
    host.canvas.setOverlay(selectionPainter(view));

    // The selection is geometry over the old canvas — meaningless after a resize.
    const offResize = host.document.onResize(() => setSelection(null));
    // Undo/redo moves pixels out from under the selection; the tool's own edits don't count.
    const offUndoRedo = host.history.onUndoRedo(() => setSelection(null));

    return () => {
      offResize();
      offUndoRedo();
      abandonDrag();
      state.host = null;
      state.mask = null;
      state.hover = null;
    };
  },

  onHover(_host, point) {
    state.hover = point;
    changed();
    return isOverSelection(point) ? "grab" : null;
  },

  onPointerDown(host, { point, modifiers, surface }) {
    state.hover = null;
    if (isOverSelection(point)) {
      state.drag = {
        kind: "move",
        origin: point,
        copy: modifiers.ctrl,
        surface,
        floating: null,
        offset: { x: 0, y: 0 },
      };
    } else {
      state.mask = null;
      // The Shape is read once, so changing it mid-drag cannot change this drag.
      if (host.tool.settings().shape === "lasso") {
        state.drag = { kind: "lasso", path: [point], mask: lassoMask(host, [point]) };
      } else {
        state.drag = { kind: "marquee", origin: point, rect: rectFromPoints(point.x, point.y, point.x, point.y) };
      }
    }
    changed();
  },

  onPointerMove(host, { point }) {
    const drag = state.drag;
    if (!drag) return;

    if (drag.kind === "marquee") {
      drag.rect = rectFromPoints(drag.origin.x, drag.origin.y, point.x, point.y);
    } else if (drag.kind === "lasso") {
      drag.path.push(point);
      drag.mask = lassoMask(host, drag.path);
    } else if (state.mask) {
      if (!drag.floating) {
        // An empty layer still lifts (transparent) so the selection can move.
        drag.floating = liftRegion(gridOf(drag.surface), state.mask, !drag.copy);
        if (!drag.copy) drag.surface.commit(state.mask.rect);
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
      state.mask = maskFromRect(drag.rect, host.document.width, host.document.height);
    } else if (drag.kind === "lasso") {
      state.mask = drag.mask;
    } else if (drag.floating) {
      const { floating, offset, surface } = drag;
      const target = { x: floating.rect.x + offset.x, y: floating.rect.y + offset.y };
      const written = stampRegion(gridOf(surface), floating, target);
      // Lift + drop share the gesture: one drag, one undo step (even when dropped off-canvas).
      surface.commit(rectUnion(written, floating.rect));
      // The selection follows the pixels.
      state.mask = maskClamped(
        maskMoved(floating.mask, target.x, target.y),
        host.document.width,
        host.document.height,
      );
    }
    changed();
  },
});

function lassoMask(host: ToolHost, path: readonly ToolPoint[]): Mask | null {
  return maskFromPath(path, host.document.width, host.document.height);
}
