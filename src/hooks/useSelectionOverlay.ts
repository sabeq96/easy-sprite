import { useEffect } from "react";
import { marchingAntsPainter } from "@/editor/overlays/selectionOverlay";
import type { CanvasRenderer } from "@/editor/renderer";
import { useEditorStore } from "@/stores/useEditorStore";

/**
 * Keeps the marching ants a pure reflection of store state — a drag-in-progress rect, a
 * committed selection, or neither — instead of something only tool pointer handlers know how
 * to repaint. Ctrl+A, paste and Escape/Deselect only ever touch the store, so without this the
 * overlay could silently fall out of sync with the selection until an unrelated mouse event
 * over a brush tool happened to touch it again.
 */
export function useSelectionOverlay(renderer: CanvasRenderer | null): void {
  const hasSelection = useEditorStore((state) => state.selection !== null);
  const hasPending = useEditorStore((state) => state.pendingRect !== null);

  useEffect(() => {
    if (!renderer) return;
    const active = hasSelection || hasPending;

    renderer.setSelectionOverlay(
      active
        ? marchingAntsPainter(
            () => useEditorStore.getState().selection,
            () => useEditorStore.getState().pendingRect,
          )
        : null,
      active,
    );
  }, [renderer, hasSelection, hasPending]);
}
