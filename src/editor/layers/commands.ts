import type { CommandRegistry } from "@/commands/types";
import {
  addLayerCommand,
  duplicateLayerCommand,
  mergeLayerDownCommand,
  removeLayerCommand,
} from "@/core/commands/layers";
import type { ModuleContext } from "@/editor/module";
import { useLayersStore } from "./store";

/** Adding, duplicating, deleting and merging layers, and stepping the active one. */
export function layerCommands({ doc, dispatch }: ModuleContext): CommandRegistry {
  const activeLayerId = () => useLayersStore.getState().activeLayerId;

  const stepLayer = (offset: number) => {
    const index = doc.layerIndex(activeLayerId() ?? "");
    const next = index + offset;
    if (next < 0 || next >= doc.layers.length) return;
    useLayersStore.getState().setActiveLayer(doc.layers[next].id);
  };

  return {
    "layer.add": {
      id: "layer.add",
      label: "New layer",
      group: "Layers",
      run: () => dispatch(() => addLayerCommand(doc, activeLayerId() ?? undefined)),
    },
    "layer.duplicate": {
      id: "layer.duplicate",
      label: "Duplicate layer",
      group: "Layers",
      isEnabled: () => activeLayerId() !== null,
      run: () => {
        const layerId = activeLayerId();
        if (layerId) dispatch(() => duplicateLayerCommand(doc, layerId));
      },
    },
    "layer.delete": {
      id: "layer.delete",
      label: "Delete layer",
      group: "Layers",
      isEnabled: () => doc.layers.length > 1,
      run: () => {
        const layerId = activeLayerId();
        if (layerId) dispatch(() => removeLayerCommand(doc, layerId));
      },
    },
    "layer.mergeDown": {
      id: "layer.mergeDown",
      label: "Merge layer down",
      group: "Layers",
      isEnabled: () => {
        const layerId = activeLayerId();
        return layerId !== null && doc.layerIndex(layerId) > 0;
      },
      run: () => {
        const layerId = activeLayerId();
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
  };
}
