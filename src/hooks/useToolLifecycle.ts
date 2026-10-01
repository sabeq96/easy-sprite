import { useEffect, type RefObject } from "react";
import type { CanvasRenderer } from "@/core/renderer";
import { useToolboxStore } from "@/editor/toolbox/api";
import { getTool, type ToolId } from "@/tools";
import type { DocumentToolHost } from "@/hooks/toolHost/createToolHost";
import { useToolHost } from "@/hooks/toolHost/ToolHostContext";

/**
 * Activates the current tool now, and deactivates and activates again on every tool change,
 * until the returned stop function deactivates it for good. `onDeactivate` runs after each
 * tool's own cleanup.
 */
export function startToolLifecycle(
  host: DocumentToolHost,
  onDeactivate: () => void = () => {},
): () => void {
  const activate = (toolId: ToolId) => {
    const toolHost = host.forTool(toolId);
    const cleanup = getTool(toolId).onActivate?.(toolHost);
    return () => {
      cleanup?.();
      toolHost.canvas.setOverlay(null);
      onDeactivate();
    };
  };

  let deactivate = activate(useToolboxStore.getState().toolId);
  // A synchronous subscription, not a selector + effect: Select All and Paste switch tools
  // and then set the selection in the same tick, so the tool must already be active.
  const unsubscribe = useToolboxStore.subscribe((state, previous) => {
    if (state.toolId === previous.toolId) return;
    deactivate();
    deactivate = activate(state.toolId);
  });

  return () => {
    unsubscribe();
    deactivate();
  };
}

/** Activates the current tool, and deactivates it on every tool change and on unmount. */
export function useToolLifecycle(
  containerRef: RefObject<HTMLElement | null>,
  renderer: CanvasRenderer | null,
): void {
  const host = useToolHost();

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !renderer) return;

    return startToolLifecycle(host, () => {
      element.style.cursor = "";
    });
  }, [containerRef, renderer, host]);
}
