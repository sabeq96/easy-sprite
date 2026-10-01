import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useSpritesheetSession } from "@/app/SpritesheetProvider";
import type { CommandRegistry } from "@/commands/types";
import { BUILDER_ZOOM_LEVELS } from "@/constants/builder";
import { ROUTES } from "@/constants/routes";
import { SHARED_KEYS } from "@/constants/shortcuts";
import type { Size } from "@/core/viewport";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";

/**
 * The spritesheet composer's commands: the edit, view and app subset of the pixel editor's,
 * under the same ids and with the same keys (`SHARED_KEYS`), so tooltips and the cheat sheet treat
 * both editors alike.
 */
export function useBuilderCommands(sheet: Size, onHelp: () => void): CommandRegistry {
  const { history, autosave } = useSpritesheetSession();
  const navigate = useNavigate();
  const store = useBuilderViewStore;

  return {
    "edit.undo": {
      id: "edit.undo",
      label: "Undo",
      group: "Edit",
      keys: SHARED_KEYS["edit.undo"],
      isEnabled: () => history.canUndo,
      run: () => history.undo(),
    },
    "edit.redo": {
      id: "edit.redo",
      label: "Redo",
      group: "Edit",
      keys: SHARED_KEYS["edit.redo"],
      isEnabled: () => history.canRedo,
      run: () => history.redo(),
    },
    "edit.save": {
      id: "edit.save",
      label: "Save now",
      group: "Edit",
      keys: SHARED_KEYS["edit.save"],
      run: () => void autosave.flush().then(() => toast.success("Saved")),
    },
    "view.zoomIn": {
      id: "view.zoomIn",
      label: "Zoom in",
      group: "View",
      keys: SHARED_KEYS["view.zoomIn"],
      isEnabled: () => store.getState().zoom < BUILDER_ZOOM_LEVELS[BUILDER_ZOOM_LEVELS.length - 1],
      run: () => store.getState().zoomBy(1),
    },
    "view.zoomOut": {
      id: "view.zoomOut",
      label: "Zoom out",
      group: "View",
      keys: SHARED_KEYS["view.zoomOut"],
      isEnabled: () => store.getState().zoom > BUILDER_ZOOM_LEVELS[0],
      run: () => store.getState().zoomBy(-1),
    },
    "view.fit": {
      id: "view.fit",
      label: "Fit to window",
      group: "View",
      keys: SHARED_KEYS["view.fit"],
      run: () => store.getState().fit(sheet),
    },
    "view.toggleGrid": {
      id: "view.toggleGrid",
      label: "Toggle grid",
      group: "View",
      keys: SHARED_KEYS["view.toggleGrid"],
      isActive: () => store.getState().gridEnabled,
      run: () => store.getState().toggleGrid(),
    },
    "app.shortcutHelp": {
      id: "app.shortcutHelp",
      label: "Keyboard shortcuts",
      group: "App",
      keys: SHARED_KEYS["app.shortcutHelp"],
      run: onHelp,
    },
    "app.backToLibrary": {
      id: "app.backToLibrary",
      label: "Back to sprites",
      group: "App",
      keys: SHARED_KEYS["app.backToLibrary"],
      run: () => navigate(ROUTES.sprites),
    },
  };
}
