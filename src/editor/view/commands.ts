import type { CommandRegistry } from "@/commands/types";
import { ZOOM_LEVELS } from "@/constants/canvas";
import type { ModuleContext } from "@/editor/module";
import { useViewStore } from "./store";

/** Zoom, fit and the pixel grid toggle; handlers read the view store when they run. */
export function viewCommands({ doc }: ModuleContext): CommandRegistry {
  const spriteSize = () => ({ width: doc.width, height: doc.height });

  return {
    "view.zoomIn": {
      id: "view.zoomIn",
      label: "Zoom in",
      group: "View",
      isEnabled: () => useViewStore.getState().viewport.scale < ZOOM_LEVELS[ZOOM_LEVELS.length - 1],
      run: () => zoomFromCentre(1),
    },
    "view.zoomOut": {
      id: "view.zoomOut",
      label: "Zoom out",
      group: "View",
      isEnabled: () => useViewStore.getState().viewport.scale > ZOOM_LEVELS[0],
      run: () => zoomFromCentre(-1),
    },
    "view.fit": {
      id: "view.fit",
      label: "Fit to window",
      group: "View",
      run: () => {
        const { containerSize, fitToContainer } = useViewStore.getState();
        fitToContainer(containerSize, spriteSize());
      },
    },
    "view.toggleGrid": {
      id: "view.toggleGrid",
      label: "Toggle pixel grid",
      group: "View",
      isActive: () => useViewStore.getState().gridEnabled,
      run: () => useViewStore.getState().toggleGrid(),
    },
  };

  function zoomFromCentre(direction: 1 | -1) {
    const { containerSize, zoom } = useViewStore.getState();
    zoom(
      { x: containerSize.width / 2, y: containerSize.height / 2 },
      direction,
      spriteSize(),
    );
  }
}
