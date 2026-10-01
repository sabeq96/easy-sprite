import { SHARED_KEYS } from "@/constants/shortcuts";
import { ZOOM_LEVELS } from "@/constants/canvas";
import type { SpriteDocument } from "@/core/document";
import { defineCommands } from "@/editor/module";
import { useViewStore } from "./store";

const spriteSize = (doc: SpriteDocument) => ({ width: doc.width, height: doc.height });

function zoomFromCentre(doc: SpriteDocument, direction: 1 | -1) {
  const { containerSize, zoom } = useViewStore.getState();
  zoom(
    { x: containerSize.width / 2, y: containerSize.height / 2 },
    direction,
    spriteSize(doc),
  );
}

/** Zoom, fit and the pixel grid toggle; handlers read the view store when they run. */
export const VIEW_COMMANDS = defineCommands([
  {
    id: "view.zoomIn",
    label: "Zoom in",
    group: "View",
    keys: SHARED_KEYS["view.zoomIn"],
    isEnabled: () => useViewStore.getState().viewport.scale < ZOOM_LEVELS[ZOOM_LEVELS.length - 1],
    run: ({ doc }) => zoomFromCentre(doc, 1),
  },
  {
    id: "view.zoomOut",
    label: "Zoom out",
    group: "View",
    keys: SHARED_KEYS["view.zoomOut"],
    isEnabled: () => useViewStore.getState().viewport.scale > ZOOM_LEVELS[0],
    run: ({ doc }) => zoomFromCentre(doc, -1),
  },
  {
    id: "view.fit",
    label: "Fit to window",
    group: "View",
    keys: SHARED_KEYS["view.fit"],
    run: ({ doc }) => {
      const { containerSize, fitToContainer } = useViewStore.getState();
      fitToContainer(containerSize, spriteSize(doc));
    },
  },
  {
    id: "view.toggleGrid",
    label: "Toggle pixel grid",
    group: "View",
    keys: SHARED_KEYS["view.toggleGrid"],
    isActive: () => useViewStore.getState().gridEnabled,
    run: () => useViewStore.getState().toggleGrid(),
  },
]);
