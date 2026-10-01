import { cropRegion, createBuffer } from "@/core/buffer";
import { compositeFrame } from "@/core/composite";
import type { SpriteDocument } from "@/core/document";
import { StrokeRecorder, type History } from "@/core/history";
import type { CanvasRenderer } from "@/core/renderer";
import type {
  Canvas,
  Colors,
  DocumentView,
  Edits,
  OverlayPaint,
  ToolControl,
  ToolHost,
} from "@/framework/host";
import type { ToolId } from "@/tools";
import { createSurface } from "@/hooks/toolHost/surface";
import { useEditorStore } from "@/stores/useEditorStore";

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
  const { activeLayerId, activeFrameId } = useEditorStore.getState();
  return activeLayerId && activeFrameId ? { layerId: activeLayerId, frameId: activeFrameId } : null;
}

function createColors(): Colors {
  return {
    get: (slot) => {
      const state = useEditorStore.getState();
      return slot === "secondary" ? state.secondaryColor : state.primaryColor;
    },
    set: (slot, color) => {
      const state = useEditorStore.getState();
      if (slot === "secondary") state.setSecondaryColor(color);
      else state.setPrimaryColor(color);
    },
  };
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
      const frameId = useEditorStore.getState().activeFrameId ?? doc.frames[0].id;
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

function createEdits(doc: SpriteDocument, history: History): Edits {
  return {
    edit(label, change) {
      const target = activeTarget();
      const layer = target && doc.getLayer(target.layerId);
      // Same rule as drawing: a locked or hidden layer is not editable.
      if (!target || !layer || layer.locked || !layer.visible) return false;

      const recorder = new StrokeRecorder(doc, label);
      change(createSurface(doc, target.layerId, target.frameId, recorder));
      const command = recorder.commit();
      if (command) history.push(command);
      return true;
    },
    onUndoRedo(listener) {
      return history.events.on("change", (kind) => {
        if (kind !== "push") listener();
      });
    },
  };
}

function createToolControl(toolId: ToolId): ToolControl {
  return {
    // setTool notifies subscribers synchronously, so the tool is active when this returns.
    activate: () => useEditorStore.getState().setTool(toolId),
    options: () => useEditorStore.getState().toolOptions,
  };
}

export function createToolHost({ doc, history }: ToolHostDeps): DocumentToolHost {
  let renderer: CanvasRenderer | null = null;
  // Remembered so an overlay set before the renderer exists still shows once it does.
  let overlay: OverlayPaint | null = null;

  const canvas: Canvas = {
    setOverlay(paint) {
      overlay = paint;
      renderer?.setToolOverlay(paint);
    },
    requestRender() {
      renderer?.invalidate("overlay");
    },
  };

  const shared = {
    colors: createColors(),
    canvas,
    document: createDocumentView(doc),
    history: createEdits(doc, history),
  };
  const views = new Map<ToolId, ToolHost>();

  return {
    forTool(toolId) {
      let view = views.get(toolId);
      if (!view) {
        view = { ...shared, tool: createToolControl(toolId) };
        views.set(toolId, view);
      }
      return view;
    },
    attachRenderer(next) {
      renderer = next;
      renderer?.setToolOverlay(overlay);
    },
  };
}
