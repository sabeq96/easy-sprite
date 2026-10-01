import type { SpriteDocument } from "@/core/document";
import { StrokeRecorder, type History } from "@/core/history";
import { useFramesStore } from "@/editor/frames/api";
import { useLayersStore } from "@/editor/layers/api";
import type { Edits, Surface } from "@/framework/host";

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

/**
 * Builds one cel's drawing surface, recording into `recorder`. The canvas owns the surface and
 * passes its factory in: importing it here would close an import cycle with the tool host, which
 * imports this adapter.
 */
export type SurfaceFactory = (
  doc: SpriteDocument,
  layerId: string,
  frameId: string,
  recorder: StrokeRecorder,
) => Surface;

/** `ToolHost.history`: a tool's edit of the active cel, recorded as one undo entry. */
export function createHistoryAdapter(
  doc: SpriteDocument,
  history: History,
  createSurface: SurfaceFactory,
): Edits {
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
