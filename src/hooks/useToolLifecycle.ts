import { useEffect, type RefObject } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import type { ToolId } from "@/editor/tools";
import type { CanvasRenderer } from "@/editor/renderer";
import { getTool } from "@/editor/tools";
import type { ToolSession } from "@/editor/tools/types";
import { useEditorStore } from "@/stores/useEditorStore";

/** Activates the current tool, and deactivates it on every tool change and on unmount. */
export function useToolLifecycle(
  containerRef: RefObject<HTMLElement | null>,
  renderer: CanvasRenderer | null,
): void {
  const { doc, history } = useDocumentSession();

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !renderer) return;

    const session: ToolSession = {
      doc,
      history,
      setOverlay: (painter) => renderer.setToolOverlay(painter),
      requestRender: () => renderer.invalidate("overlay"),
    };

    const activate = (toolId: ToolId) => {
      const cleanup = getTool(toolId).onActivate?.(session);
      return () => {
        cleanup?.();
        renderer.setToolOverlay(null);
        element.style.cursor = "";
      };
    };

    let deactivate = activate(useEditorStore.getState().toolId);
    // A synchronous subscription, not a selector + effect: Select All and Paste switch tools
    // and then set the selection in the same tick, so the tool must already be active.
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (state.toolId === previous.toolId) return;
      deactivate();
      deactivate = activate(state.toolId);
    });

    return () => {
      unsubscribe();
      deactivate();
    };
  }, [containerRef, renderer, doc, history]);
}
