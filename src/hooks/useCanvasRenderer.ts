import { useEffect, useRef, useState } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { drawGrid } from "@/core/painters/grid";
import { drawOnion } from "@/core/painters/onion";
import { CanvasRenderer, type RendererTargets } from "@/core/renderer";
import { useFramesStore } from "@/editor/frames/api";
import { useEditorStore } from "@/stores/useEditorStore";

export interface CanvasRefs {
  containerRef: React.RefObject<HTMLDivElement | null>;
  mainRef: React.RefObject<HTMLCanvasElement | null>;
  onionRef: React.RefObject<HTMLCanvasElement | null>;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;
  renderer: CanvasRenderer | null;
}

/** Owns the imperative renderer and keeps it in sync with the store. */
export function useCanvasRenderer(): CanvasRefs {
  const { doc } = useDocumentSession();

  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLCanvasElement>(null);
  const onionRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [renderer, setRenderer] = useState<CanvasRenderer | null>(null);

  const viewport = useEditorStore((state) => state.viewport);
  const activeFrameId = useFramesStore((state) => state.activeFrameId);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const fitToContainer = useEditorStore((state) => state.fitToContainer);
  const toolSettings = useEditorStore((state) => state.settings);

  // One renderer per document.
  useEffect(() => {
    const targets: RendererTargets | null =
      mainRef.current && onionRef.current && overlayRef.current
        ? { main: mainRef.current, onion: onionRef.current, overlay: overlayRef.current }
        : null;
    if (!targets) return;

    const store = useEditorStore.getState();
    const instance = new CanvasRenderer(doc, targets, {
      viewport: store.viewport,
      frameId: useFramesStore.getState().activeFrameId ?? doc.frames[0].id,
      isPlaying: false,
    });

    // Registration order is stacking order: these go in before any tool attaches, so a tool's
    // overlay (added per activation through the tool host) always draws above the grid.
    const scratch = new OffscreenCanvas(1, 1);
    instance.addPainter({
      channel: "overlay",
      paint: (p) => {
        const { gridEnabled, gridSize } = useEditorStore.getState();
        if (gridEnabled) drawGrid(p, gridSize);
      },
    });
    instance.addPainter({
      channel: "onion",
      // Onion skin is meaningless during playback and costs a composite per ghost frame.
      paint: (p) => {
        const { onion } = useEditorStore.getState();
        if (onion.enabled && !p.isPlaying) drawOnion(p, onion, scratch);
      },
    });

    // The painters read the store at paint time; repaint their channel when what they read changes.
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (state.gridEnabled !== previous.gridEnabled || state.gridSize !== previous.gridSize) {
        instance.invalidate("overlay");
      }
      if (state.onion !== previous.onion) instance.invalidate("onion");
    });

    setRenderer(instance);
    return () => {
      unsubscribe();
      instance.dispose();
      setRenderer(null);
    };
  }, [doc]);

  // Size to the container, and fit the sprite on first layout.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !renderer) return;

    let fitted = false;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;

      renderer.resize(width, height);
      if (fitted) {
        useEditorStore.getState().setContainerSize({ width, height });
        return;
      }
      fitted = true;
      fitToContainer({ width, height }, { width: doc.width, height: doc.height });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [renderer, doc, fitToContainer]);

  // Push store state into the imperative renderer.
  useEffect(() => {
    renderer?.setState({ viewport, frameId: activeFrameId ?? doc.frames[0].id, isPlaying });
  }, [renderer, viewport, activeFrameId, isPlaying, doc]);

  // A tool's overlay may draw its settings (the brush preview's size and mirror), and the
  // overlay only repaints on demand, so a changed setting shows without moving the pointer.
  useEffect(() => {
    if (renderer && toolSettings) renderer.invalidate("overlay");
  }, [renderer, toolSettings]);

  // Structural changes (layer order, visibility, opacity) are not pixel events.
  useEffect(() => {
    if (!renderer) return;
    const offStructure = doc.events.on("structure", () => renderer.invalidateAll());
    const offMeta = doc.events.on("meta", () => renderer.invalidateAll());
    return () => {
      offStructure();
      offMeta();
    };
  }, [renderer, doc]);

  return { containerRef, mainRef, onionRef, overlayRef, renderer };
}
