import { toast } from "sonner";
import { ROUTES } from "@/constants/routes";
import { SHARED_KEYS } from "@/constants/shortcuts";
import { defineCommands } from "@/editor/module";

/** Undo, redo, save, the shortcut sheet and leaving the editor. */
export const SHELL_COMMANDS = defineCommands([
  {
    id: "edit.undo",
    label: "Undo",
    group: "Edit",
    keys: SHARED_KEYS["edit.undo"],
    isEnabled: ({ history }) => history.canUndo,
    run: ({ history }) => history.undo(),
  },
  {
    id: "edit.redo",
    label: "Redo",
    group: "Edit",
    keys: SHARED_KEYS["edit.redo"],
    isEnabled: ({ history }) => history.canRedo,
    run: ({ history }) => history.redo(),
  },
  {
    id: "edit.save",
    label: "Save now",
    group: "Edit",
    keys: SHARED_KEYS["edit.save"],
    run: ({ save }) => void save().then(() => toast.success("Saved")),
  },
  {
    id: "app.shortcutHelp",
    label: "Keyboard shortcuts",
    group: "App",
    keys: SHARED_KEYS["app.shortcutHelp"],
    run: ({ showHelp }) => showHelp(),
  },
  {
    id: "app.backToLibrary",
    label: "Back to sprites",
    group: "App",
    keys: SHARED_KEYS["app.backToLibrary"],
    run: ({ navigate }) => navigate(ROUTES.sprites),
  },
]);
