import { useDocumentSession } from "@/app/DocumentProvider";
import { createContributedCommands } from "@/commands/contributed";
import { createToolCommands } from "@/commands/toolCommands";
import type { CommandRegistry } from "@/commands/types";
import { ZOOM_LEVELS } from "@/constants/canvas";
import { useToolHost } from "@/hooks/toolHost/ToolHostContext";
import { useEditorStore } from "@/stores/useEditorStore";

/**
 * The commands not yet moved into a host module (`EDITOR_MODULES`); the shell merges both.
 * Every surface — toolbar, menus, keymap, cheat sheet — reads the merged registry, so they
 * cannot drift apart.
 */
export function useEditorCommands(): CommandRegistry {
  const { doc } = useDocumentSession();
  const toolHost = useToolHost();

  // Read via getState() inside handlers so the registry does not churn every render.
  const store = useEditorStore;

  const spriteSize = () => ({ width: doc.width, height: doc.height });

  return {
    ...createToolCommands(store),
    // The selection's copy, cut, paste, … are the select tool's own (see `Tool.commands`).
    ...createContributedCommands(toolHost),

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
