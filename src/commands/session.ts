import { toast } from "sonner";
import { commandsFor } from "@/commands/define";
import { ROUTES } from "@/constants/routes";
import type { History } from "@/core/history";

/** What every editing page hands its session commands, whatever document it edits. */
export interface SessionContext {
  readonly history: History;
  navigate(to: string): void;
  showHelp(): void;
  /** Writes every pending change to the database now. */
  save(): Promise<void>;
}

/**
 * Undo, redo, save, Keyboard shortcuts and leaving for the library: defined once, bound by both the
 * Editor and the Builder, so the two cannot drift apart.
 */
export const SESSION_COMMANDS = commandsFor<SessionContext>()([
  {
    id: "edit.undo",
    label: "Undo",
    group: "Edit",
    keys: [{ key: "z", mod: true }],
    isEnabled: ({ history }) => history.canUndo,
    run: ({ history }) => history.undo(),
  },
  {
    id: "edit.redo",
    label: "Redo",
    group: "Edit",
    keys: [
      { key: "z", mod: true, shift: true },
      { key: "y", mod: true },
    ],
    isEnabled: ({ history }) => history.canRedo,
    run: ({ history }) => history.redo(),
  },
  {
    id: "edit.save",
    label: "Save now",
    group: "Edit",
    keys: [{ key: "s", mod: true }],
    run: ({ save }) => void save().then(() => toast.success("Saved")),
  },
  {
    id: "app.keyboardShortcuts",
    label: "Keyboard shortcuts",
    group: "App",
    keys: [{ key: "?" }],
    run: ({ showHelp }) => showHelp(),
  },
  {
    id: "app.backToLibrary",
    label: "Back to library",
    group: "App",
    keys: [{ key: "escape", shift: true }],
    run: ({ navigate }) => navigate(ROUTES.sprites),
  },
]);
