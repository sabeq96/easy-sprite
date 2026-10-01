import { useEffect } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import type { EditorModule } from "@/editor/module";
import { CheckerboardLayer, useViewStore } from "@/editor/view/api";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { useToolHost } from "./toolHost/ToolHostContext";
import { useCanvasRenderer } from "./useCanvasRenderer";
import { useCanvasViewControls } from "./useCanvasViewControls";
import { usePointerPaint } from "./usePointerPaint";
import { useToolLifecycle } from "./useToolLifecycle";

export interface EditorCanvasProps {
  /** `EDITOR_MODULES`: each module's `attachCanvas` runs, in this order, when the renderer is created. */
  modules: readonly EditorModule[];
}

/** The only component in the app that holds canvas refs. */
export function EditorCanvas({ modules }: EditorCanvasProps) {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);
  const { containerRef, mainRef, onionRef, overlayRef, renderer } = useCanvasRenderer(modules);
  const viewport = useViewStore((state) => state.viewport);
  const checkerSize = useViewStore((state) => state.checkerSize);
  const toolHost = useToolHost();

  // Tools draw their overlays through the host, which forwards to this canvas's renderer.
  useEffect(() => {
    toolHost.attachRenderer(renderer);
    return () => toolHost.attachRenderer(null);
  }, [toolHost, renderer]);

  useToolLifecycle(containerRef, renderer);
  useCanvasViewControls(containerRef);
  usePointerPaint(containerRef, renderer);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Sprite canvas"
      tabIndex={0}
      className="relative size-full touch-none overflow-hidden rounded-xl bg-canvas-bg shadow-sm outline-none"
    >
      <CheckerboardLayer
        viewport={viewport}
        width={snapshot.width}
        height={snapshot.height}
        tileSize={checkerSize}
      />
      {/* All canvases are pointer-events-none: hit testing happens on the container. */}
      <canvas ref={onionRef} data-canvas="onion" className="pointer-events-none absolute inset-0" />
      <canvas ref={mainRef} data-canvas="main" className="pointer-events-none absolute inset-0" />
      <canvas ref={overlayRef} data-canvas="overlay" className="pointer-events-none absolute inset-0" />
    </div>
  );
}
