import { useEffect, useRef, useState } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { CanvasRenderer, type RendererTargets } from "@/core/renderer";
import { useAnimationStore } from "@/editor/animation/api";
import { useFramesStore } from "@/editor/frames/api";
import { EDITOR_MODULES } from "@/editor/modules";
import { useViewStore } from "@/editor/view/api";
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

  const viewport = useViewStore((state) => state.viewport);
  const activeFrameId = useFramesStore((state) => state.activeFrameId);
  const isPlaying = useAnimationStore((state) => state.isPlaying);
  const fitToContainer = useViewStore((state) => state.fitToContainer);
  const toolSettings = useEditorStore((state) => state.settings);

  // One renderer per document.
  useEffect(() => {
    const targets: RendererTargets | null =
      mainRef.current && onionRef.current && overlayRef.current
        ? { main: mainRef.current, onion: onionRef.current, overlay: overlayRef.current }
        : null;
    if (!targets) return;

    const instance = new CanvasRenderer(doc, targets, {
      viewport: useViewStore.getState().viewport,
      frameId: useFramesStore.getState().activeFrameId ?? doc.frames[0].id,
      isPlaying: false,
    });

    // Each module registers its own painters (the grid, the onion skin) and repaint listeners, in
    // module order. Registration order is stacking order: they go in before any tool attaches, so
    // a tool's overlay (added per activation through the tool host) always draws above the grid.
    const detachModules = EDITOR_MODULES.map((module) => module.attachCanvas?.(instance, doc));

    setRenderer(instance);
    return () => {
      for (const detach of detachModules) detach?.();
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
        useViewStore.getState().setContainerSize({ width, height });
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
