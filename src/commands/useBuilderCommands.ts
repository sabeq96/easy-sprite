import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useSpritesheetSession } from "@/app/SpritesheetProvider";
import type { CommandRegistry } from "@/commands/types";
import { BUILDER_ZOOM_LEVELS } from "@/constants/builder";
import { ROUTES } from "@/constants/routes";
import type { Size } from "@/editor/viewport";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";

/**
 * The spritesheet composer's commands: the edit, view and app subset of the pixel editor's,
 * under the same ids, so the keymap, tooltips and cheat sheet treat both editors alike.
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
    "view.zoomIn": {
      id: "view.zoomIn",
      label: "Zoom in",
      group: "View",
      isEnabled: () => store.getState().zoom < BUILDER_ZOOM_LEVELS[BUILDER_ZOOM_LEVELS.length - 1],
      run: () => store.getState().zoomBy(1),
    },
    "view.zoomOut": {
      id: "view.zoomOut",
      label: "Zoom out",
      group: "View",
      isEnabled: () => store.getState().zoom > BUILDER_ZOOM_LEVELS[0],
      run: () => store.getState().zoomBy(-1),
    },
    "view.fit": {
      id: "view.fit",
      label: "Fit to window",
      group: "View",
      run: () => store.getState().fit(sheet),
    },
    "view.toggleGrid": {
      id: "view.toggleGrid",
      label: "Toggle grid",
      group: "View",
      isActive: () => store.getState().gridEnabled,
      run: () => store.getState().toggleGrid(),
    },
    "app.shortcutHelp": {
      id: "app.shortcutHelp",
      label: "Keyboard shortcuts",
      group: "App",
      run: onHelp,
    },
    "app.backToLibrary": {
      id: "app.backToLibrary",
      label: "Back to sprites",
      group: "App",
      run: () => navigate(ROUTES.sprites),
    },
  };
}
