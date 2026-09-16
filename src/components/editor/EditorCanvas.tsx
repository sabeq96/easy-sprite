import { useDocumentSession } from "@/app/DocumentProvider";
import { CheckerboardLayer } from "@/components/editor/CheckerboardLayer";
import { useCanvasRenderer } from "@/hooks/useCanvasRenderer";
import { useCanvasViewControls } from "@/hooks/useCanvasViewControls";
import { useEditorStore } from "@/stores/useEditorStore";

/** The only component in the app that holds canvas refs. */
export function EditorCanvas() {
  const { doc } = useDocumentSession();
  const { containerRef, mainRef, onionRef, overlayRef } = useCanvasRenderer();
  const viewport = useEditorStore((state) => state.viewport);

  useCanvasViewControls(containerRef);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Sprite canvas"
      tabIndex={0}
      className="relative size-full touch-none overflow-hidden bg-canvas-bg outline-none"
    >
      <CheckerboardLayer viewport={viewport} width={doc.width} height={doc.height} />
      {/* All canvases are pointer-events-none: hit testing happens on the container. */}
      <canvas ref={onionRef} className="pointer-events-none absolute inset-0" />
      <canvas ref={mainRef} className="pointer-events-none absolute inset-0" />
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0" />
    </div>
  );
}
