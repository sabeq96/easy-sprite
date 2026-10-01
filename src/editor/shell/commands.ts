import { toast } from "sonner";
import type { CommandRegistry } from "@/commands/types";
import { ROUTES } from "@/constants/routes";
import type { ModuleContext } from "@/editor/module";

/** Undo, redo, save, the shortcut sheet and leaving the editor. */
export function shellCommands({ history, navigate, save, showHelp }: ModuleContext): CommandRegistry {
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
      run: () => void save().then(() => toast.success("Saved")),
    },
    "app.shortcutHelp": {
      id: "app.shortcutHelp",
      label: "Keyboard shortcuts",
      group: "App",
      run: () => showHelp(),
    },
    "app.backToLibrary": {
      id: "app.backToLibrary",
      label: "Back to sprites",
      group: "App",
      run: () => navigate(ROUTES.sprites),
    },
  };
}
