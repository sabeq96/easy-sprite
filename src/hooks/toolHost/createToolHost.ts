import { cropRegion, createBuffer } from "@/core/buffer";
import { compositeFrame } from "@/core/composite";
import type { SpriteDocument } from "@/core/document";
import type { History } from "@/core/history";
import type { CanvasRenderer } from "@/core/renderer";
import { useFramesStore } from "@/editor/frames/api";
import { useLayersStore } from "@/editor/layers/api";
import { createColorsAdapter } from "@/editor/palette/api";
import { createHistoryAdapter } from "@/editor/shell/api";
import { createToolAdapter } from "@/editor/toolbox/api";
import type { Canvas, DocumentView, OverlayPaint, ToolHost } from "@/framework/host";
import type { ToolId } from "@/tools";

export interface ToolHostDeps {
  doc: SpriteDocument;
  history: History;
}

/**
 * The tool host of one open document. Every capability is shared; only `tool` differs per
 * tool, because `tool.activate()` has to know which tool is calling.
 */
export interface DocumentToolHost {
  /** The host as `toolId` sees it. The same object every time for the same tool. */
  forTool(toolId: ToolId): ToolHost;
  /** Points `canvas` at the renderer once `EditorCanvas` has one; null detaches it. */
  attachRenderer(renderer: CanvasRenderer | null): void;
}

interface Target {
  layerId: string;
  frameId: string;
}

/** The active layer and frame, as chosen in the panels; null before they are chosen. */
function activeTarget(): Target | null {
  const { activeLayerId } = useLayersStore.getState();
  const { activeFrameId } = useFramesStore.getState();
  return activeLayerId && activeFrameId ? { layerId: activeLayerId, frameId: activeFrameId } : null;
}

function createDocumentView(doc: SpriteDocument): DocumentView {
  return {
    get width() {
      return doc.width;
    },
    get height() {
      return doc.height;
    },
    sampleComposite(x, y) {
      if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return null;
      const frameId = useFramesStore.getState().activeFrameId ?? doc.frames[0].id;
      const data = compositeFrame(doc, frameId).getContext("2d")?.getImageData(x, y, 1, 1)?.data;
      return data ? { r: data[0], g: data[1], b: data[2], a: data[3] } : null;
    },
    crop(rect) {
      const target = activeTarget();
      if (!target) return null;
      const cel = doc.getCel(target.layerId, target.frameId);
      return cel ? cropRegion(cel.pixels, doc.width, rect) : createBuffer(rect.w, rect.h);
    },
    onResize(listener) {
      let { width, height } = doc;
      return doc.events.on("meta", () => {
        if (doc.width === width && doc.height === height) return;
        ({ width, height } = doc);
        listener();
      });
    },
  };
}

export function createToolHost({ doc, history }: ToolHostDeps): DocumentToolHost {
  let renderer: CanvasRenderer | null = null;
  // Remembered so an overlay set before the renderer exists still shows once it does.
  let overlay: OverlayPaint | null = null;
  let removeOverlay: (() => void) | null = null;

  /** Registered after the host's own painters (grid), so the tool's overlay draws above them. */
  function showOverlay(): void {
    removeOverlay?.();
    removeOverlay =
      renderer && overlay ? renderer.addPainter({ channel: "overlay", paint: overlay }) : null;
  }

  const canvas: Canvas = {
    setOverlay(paint) {
      overlay = paint;
      showOverlay();
    },
    requestRender() {
      renderer?.invalidate("overlay");
    },
  };

  const shared = {
    colors: createColorsAdapter(),
    canvas,
    document: createDocumentView(doc),
    history: createHistoryAdapter(doc, history),
  };
  const views = new Map<ToolId, ToolHost>();

  return {
    forTool(toolId) {
      let view = views.get(toolId);
      if (!view) {
        view = { ...shared, tool: createToolAdapter(toolId) };
        views.set(toolId, view);
      }
      return view;
    },
    attachRenderer(next) {
      renderer = next;
      showOverlay(); // the remover is bound to the renderer it was added to
    },
  };
}
