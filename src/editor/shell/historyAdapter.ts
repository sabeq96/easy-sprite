import type { SpriteDocument } from "@/core/document";
import { StrokeRecorder, type History } from "@/core/history";
import type { Edits } from "@/framework/host";
import { createSurface } from "@/hooks/toolHost/surface";
import { useEditorStore } from "@/stores/useEditorStore";

interface Target {
  layerId: string;
  frameId: string;
}

/** The active layer and frame, as chosen in the panels; null before they are chosen. */
function activeTarget(): Target | null {
  const { activeLayerId, activeFrameId } = useEditorStore.getState();
  return activeLayerId && activeFrameId ? { layerId: activeLayerId, frameId: activeFrameId } : null;
}

/** `ToolHost.history`: a tool's edit of the active cel, recorded as one undo entry. */
export function createHistoryAdapter(doc: SpriteDocument, history: History): Edits {
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
