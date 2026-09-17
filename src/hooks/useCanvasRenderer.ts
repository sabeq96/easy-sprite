import { useEffect, useRef, useState } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { CanvasRenderer, type RendererTargets } from "@/editor/renderer";
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
  const gridEnabled = useEditorStore((state) => state.gridEnabled);
  const onion = useEditorStore((state) => state.onion);
  const activeFrameId = useEditorStore((state) => state.activeFrameId);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const fitToContainer = useEditorStore((state) => state.fitToContainer);

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
      frameId: store.activeFrameId ?? doc.frames[0].id,
      gridEnabled: store.gridEnabled,
      onion: store.onion,
      isPlaying: false,
    });

    setRenderer(instance);
    return () => {
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
    renderer?.setState({
      viewport,
      gridEnabled,
      onion,
      frameId: activeFrameId ?? doc.frames[0].id,
      isPlaying,
    });
  }, [renderer, viewport, gridEnabled, onion, activeFrameId, isPlaying, doc]);

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
