import type { Selection } from "@/editor/selection";
import { createRectSelection, selectAll } from "@/editor/selection";
import type { Rect } from "@/lib/rect";
import type { Size } from "@/editor/viewport";
import type { SliceCreator } from "@/stores/slices/types";

export interface SelectionSlice {
  selection: Selection | null;
  /** Mirror of `selection.mask`, read by ToolContext so tools stay store-free. */
  selectionMask: Uint8Array | null;
  /** Live rect while dragging a new selection — overlay only, not yet committed. */
  pendingRect: Rect | null;

  setSelection: (selection: Selection | null) => void;
  setSelectionRect: (rect: Rect, size: Size) => void;
  setPendingRect: (rect: Rect | null) => void;
  selectAllPixels: (size: Size) => void;
  clearSelection: () => void;
}

export const createSelectionSlice: SliceCreator<SelectionSlice> = (set) => ({
  selection: null,
  selectionMask: null,
  pendingRect: null,

  setSelection: (selection) => set({ selection, selectionMask: selection?.mask ?? null }),

  setSelectionRect: (rect, size) => {
    const selection = createRectSelection(size.width, size.height, rect);
    set({ selection, selectionMask: selection?.mask ?? null, pendingRect: null });
  },

  setPendingRect: (pendingRect) => set({ pendingRect }),

  selectAllPixels: (size) => {
    const selection = selectAll(size.width, size.height);
    set({ selection, selectionMask: selection.mask, pendingRect: null });
  },

  clearSelection: () => set({ selection: null, selectionMask: null, pendingRect: null }),
});
