import { useDocumentSession } from "@/app/DocumentProvider";
import { CheckerboardLayer } from "@/components/editor/CheckerboardLayer";
import { useCanvasRenderer } from "@/hooks/useCanvasRenderer";
import { useCanvasViewControls } from "@/hooks/useCanvasViewControls";
import { usePointerPaint } from "@/hooks/usePointerPaint";
import { useSelectionBridge } from "@/hooks/useSelectionBridge";
import { useSelectionOverlay } from "@/hooks/useSelectionOverlay";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { useEditorStore } from "@/stores/useEditorStore";

/** The only component in the app that holds canvas refs. */
export function EditorCanvas() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);
  const { containerRef, mainRef, onionRef, overlayRef, renderer } = useCanvasRenderer();
  const viewport = useEditorStore((state) => state.viewport);
  const gridSize = useEditorStore((state) => state.gridSize);

  useSelectionBridge();
  useSelectionOverlay(renderer);
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
        gridSize={gridSize}
      />
      {/* All canvases are pointer-events-none: hit testing happens on the container. */}
      <canvas ref={onionRef} data-canvas="onion" className="pointer-events-none absolute inset-0" />
      <canvas ref={mainRef} data-canvas="main" className="pointer-events-none absolute inset-0" />
      <canvas ref={overlayRef} data-canvas="overlay" className="pointer-events-none absolute inset-0" />
    </div>
  );
}
