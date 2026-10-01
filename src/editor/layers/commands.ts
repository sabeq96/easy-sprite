import {
  addLayerCommand,
  duplicateLayerCommand,
  mergeLayerDownCommand,
  removeLayerCommand,
} from "@/core/commands/layers";
import type { SpriteDocument } from "@/core/document";
import { defineCommands } from "@/editor/module";
import { useLayersStore } from "./store";

const activeLayerId = () => useLayersStore.getState().activeLayerId;

function stepLayer(doc: SpriteDocument, offset: number) {
  const index = doc.layerIndex(activeLayerId() ?? "");
  const next = index + offset;
  if (next < 0 || next >= doc.layers.length) return;
  useLayersStore.getState().setActiveLayer(doc.layers[next].id);
}

/** Adding, duplicating, deleting and merging layers, and stepping the active one. */
export const LAYER_COMMANDS = defineCommands([
  {
    id: "layer.add",
    label: "New layer",
    group: "Layers",
    keys: [{ key: "n", mod: true, shift: true }],
    run: ({ doc, dispatch }) => dispatch(() => addLayerCommand(doc, activeLayerId() ?? undefined)),
  },
  {
    id: "layer.duplicate",
    label: "Duplicate layer",
    group: "Layers",
    isEnabled: () => activeLayerId() !== null,
    run: ({ doc, dispatch }) => {
      const layerId = activeLayerId();
      if (layerId) dispatch(() => duplicateLayerCommand(doc, layerId));
    },
  },
  {
    id: "layer.delete",
    label: "Delete layer",
    group: "Layers",
    isEnabled: ({ doc }) => doc.layers.length > 1,
    run: ({ doc, dispatch }) => {
      const layerId = activeLayerId();
      if (layerId) dispatch(() => removeLayerCommand(doc, layerId));
    },
  },
  {
    id: "layer.mergeDown",
    label: "Merge layer down",
    group: "Layers",
    keys: [{ key: "e", mod: true }],
    isEnabled: ({ doc }) => {
      const layerId = activeLayerId();
      return layerId !== null && doc.layerIndex(layerId) > 0;
    },
    run: ({ doc, dispatch }) => {
      const layerId = activeLayerId();
      if (layerId) dispatch(() => mergeLayerDownCommand(doc, layerId));
    },
  },
  {
    id: "layer.selectAbove",
    label: "Select layer above",
    group: "Layers",
    keys: [{ key: "pageup" }],
    run: ({ doc }) => stepLayer(doc, 1),
  },
  {
    id: "layer.selectBelow",
    label: "Select layer below",
    group: "Layers",
    keys: [{ key: "pagedown" }],
    run: ({ doc }) => stepLayer(doc, -1),
  },
]);
