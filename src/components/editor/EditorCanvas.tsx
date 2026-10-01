import { useEffect } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { CheckerboardLayer, useViewStore } from "@/editor/view/api";
import { useCanvasRenderer } from "@/hooks/useCanvasRenderer";
import { useCanvasViewControls } from "@/hooks/useCanvasViewControls";
import { usePointerPaint } from "@/hooks/usePointerPaint";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { useToolLifecycle } from "@/hooks/useToolLifecycle";
import { useToolHost } from "@/hooks/toolHost/ToolHostContext";

/** The only component in the app that holds canvas refs. */
export function EditorCanvas() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);
  const { containerRef, mainRef, onionRef, overlayRef, renderer } = useCanvasRenderer();
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
