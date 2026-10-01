import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useDocumentSession } from "@/app/DocumentProvider";
import { createContributedCommands } from "@/commands/contributed";
import { createToolCommands } from "@/commands/toolCommands";
import type { CommandRegistry } from "@/commands/types";
import { ZOOM_LEVELS } from "@/constants/canvas";
import { ROUTES } from "@/constants/routes";
import {
  addFrameCommand,
  duplicateFrameCommand,
  moveFrameCommand,
  removeFrameCommand,
} from "@/core/commands/frames";
import {
  addLayerCommand,
  duplicateLayerCommand,
  mergeLayerDownCommand,
  removeLayerCommand,
} from "@/core/commands/layers";
import { useCommandDispatch } from "@/hooks/useCommandDispatch";
import { useToolHost } from "@/hooks/toolHost/ToolHostContext";
import { useEditorStore } from "@/stores/useEditorStore";

/**
 * The only place that maps a user action onto a document mutation. Every surface — toolbar,
 * menus, keymap, cheat sheet — reads from here, so they cannot drift apart.
 */
export function useEditorCommands(): CommandRegistry {
  const { doc, history, autosave } = useDocumentSession();
  const dispatch = useCommandDispatch();
  const navigate = useNavigate();
  const toolHost = useToolHost();

  // Read via getState() inside handlers so the registry does not churn every render.
  const store = useEditorStore;

  const spriteSize = () => ({ width: doc.width, height: doc.height });

  const stepFrame = (offset: number) => {
    const { activeFrameId, setActiveFrame } = store.getState();
    const index = doc.frameIndex(activeFrameId ?? "");
    const next = (index + offset + doc.frames.length) % doc.frames.length;
    setActiveFrame(doc.frames[next].id);
  };

  const stepLayer = (offset: number) => {
    const { activeLayerId, setActiveLayer } = store.getState();
    const index = doc.layerIndex(activeLayerId ?? "");
    const next = index + offset;
    if (next < 0 || next >= doc.layers.length) return;
    setActiveLayer(doc.layers[next].id);
  };

  return {
    ...createToolCommands(store),
    // The selection's copy, cut, paste, … are the select tool's own (see `Tool.commands`).
    ...createContributedCommands(toolHost),

    "edit.undo": {
      id: "edit.undo",
      label: "Undo",
      group: "Edit",
      isEnabled: () => history.canUndo,
      run: () => history.undo(),
    },
    "edit.redo": {
      id: "edit.redo",
      label: "Redo",
      group: "Edit",
      isEnabled: () => history.canRedo,
      run: () => history.redo(),
    },
    "edit.save": {
      id: "edit.save",
      label: "Save now",
      group: "Edit",
      run: () => void autosave.flush().then(() => toast.success("Saved")),
    },

    "color.swap": {
      id: "color.swap",
      label: "Swap colors",
      group: "Color",
      run: () => store.getState().swapColors(),
    },
    "color.reset": {
      id: "color.reset",
      label: "Reset colors",
      group: "Color",
      run: () => store.getState().resetColors(),
    },

    "layer.add": {
      id: "layer.add",
      label: "New layer",
      group: "Layers",
      run: () => dispatch(() => addLayerCommand(doc, store.getState().activeLayerId ?? undefined)),
    },
    "layer.duplicate": {
      id: "layer.duplicate",
      label: "Duplicate layer",
      group: "Layers",
      isEnabled: () => store.getState().activeLayerId !== null,
      run: () => {
        const layerId = store.getState().activeLayerId;
        if (layerId) dispatch(() => duplicateLayerCommand(doc, layerId));
      },
    },
    "layer.delete": {
      id: "layer.delete",
      label: "Delete layer",
      group: "Layers",
      isEnabled: () => doc.layers.length > 1,
      run: () => {
        const layerId = store.getState().activeLayerId;
        if (layerId) dispatch(() => removeLayerCommand(doc, layerId));
      },
    },
    "layer.mergeDown": {
      id: "layer.mergeDown",
      label: "Merge layer down",
      group: "Layers",
      isEnabled: () => {
        const layerId = store.getState().activeLayerId;
        return layerId !== null && doc.layerIndex(layerId) > 0;
      },
      run: () => {
        const layerId = store.getState().activeLayerId;
        if (layerId) dispatch(() => mergeLayerDownCommand(doc, layerId));
      },
    },
    "layer.selectAbove": {
      id: "layer.selectAbove",
      label: "Select layer above",
      group: "Layers",
      run: () => stepLayer(1),
    },
    "layer.selectBelow": {
      id: "layer.selectBelow",
      label: "Select layer below",
      group: "Layers",
      run: () => stepLayer(-1),
    },

    "frame.add": {
      id: "frame.add",
      label: "New frame",
      group: "Frames",
      run: () => dispatch(() => addFrameCommand(doc, store.getState().activeFrameId ?? undefined)),
    },
    "frame.duplicate": {
      id: "frame.duplicate",
      label: "Duplicate frame",
      group: "Frames",
      run: () => {
        const frameId = store.getState().activeFrameId;
        if (frameId) dispatch(() => duplicateFrameCommand(doc, frameId));
      },
    },
    "frame.delete": {
      id: "frame.delete",
      label: "Delete frame",
      group: "Frames",
      isEnabled: () => doc.frames.length > 1,
      run: () => {
        const frameId = store.getState().activeFrameId;
        if (frameId) dispatch(() => removeFrameCommand(doc, frameId));
      },
    },
    "frame.previous": {
      id: "frame.previous",
      label: "Previous frame",
      group: "Frames",
      run: () => stepFrame(-1),
    },
    "frame.next": {
      id: "frame.next",
      label: "Next frame",
      group: "Frames",
      run: () => stepFrame(1),
    },
    "frame.moveLeft": {
      id: "frame.moveLeft",
      label: "Move frame left",
      group: "Frames",
      run: () => {
        const index = doc.frameIndex(store.getState().activeFrameId ?? "");
        dispatch(() => moveFrameCommand(doc, index, index - 1));
      },
    },
    "frame.moveRight": {
      id: "frame.moveRight",
      label: "Move frame right",
      group: "Frames",
      run: () => {
        const index = doc.frameIndex(store.getState().activeFrameId ?? "");
        dispatch(() => moveFrameCommand(doc, index, index + 1));
      },
    },

    "view.zoomIn": {
      id: "view.zoomIn",
      label: "Zoom in",
      group: "View",
      isEnabled: () => store.getState().viewport.scale < ZOOM_LEVELS[ZOOM_LEVELS.length - 1],
      run: () => zoomFromCentre(1),
    },
    "view.zoomOut": {
      id: "view.zoomOut",
      label: "Zoom out",
      group: "View",
      isEnabled: () => store.getState().viewport.scale > ZOOM_LEVELS[0],
      run: () => zoomFromCentre(-1),
    },
    "view.fit": {
      id: "view.fit",
      label: "Fit to window",
      group: "View",
      run: () => {
        const { containerSize, fitToContainer } = store.getState();
        fitToContainer(containerSize, spriteSize());
      },
    },
    "view.toggleGrid": {
      id: "view.toggleGrid",
      label: "Toggle pixel grid",
      group: "View",
      isActive: () => store.getState().gridEnabled,
      run: () => store.getState().toggleGrid(),
    },
    "view.toggleOnion": {
      id: "view.toggleOnion",
      label: "Toggle onion skin",
      group: "View",
      isActive: () => store.getState().onion.enabled,
      run: () => {
        const { onion, setOnion } = store.getState();
        setOnion({ enabled: !onion.enabled });
      },
    },

    "app.backToLibrary": {
      id: "app.backToLibrary",
      label: "Back to sprites",
      group: "App",
      run: () => navigate(ROUTES.sprites),
    },
  };

  function zoomFromCentre(direction: 1 | -1) {
    const { containerSize, zoom } = store.getState();
    zoom(
      { x: containerSize.width / 2, y: containerSize.height / 2 },
      direction,
      spriteSize(),
    );
  }
}
