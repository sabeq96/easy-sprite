import type { AppCommandId, CommandGroup } from "@/constants/commands";
import type { ToolId } from "@/core/tools";

export type ToolCommandId = `tool.${ToolId}`;
export type CommandId = AppCommandId | ToolCommandId;

export interface CommandDefinition {
  id: CommandId;
  /** Shown in menus, tooltips and the cheat sheet — one source of truth for wording. */
  label: string;
  group: CommandGroup;
  /** Computed at read time; surfaces dim disabled commands rather than hiding them. */
  isEnabled?: () => boolean;
  isActive?: () => boolean;
  run: () => void;
  /** When set, a key bound to this command calls `hold` instead of `run`, and reports its release. */
  hold?: CommandHold;
}

/** One physical key press: `KeyboardEvent.code` and `timeStamp`. */
export interface KeyPress {
  code: string;
  at: number;
}

export interface CommandHold {
  press: (key: KeyPress) => void;
  release: (key: KeyPress) => void;
  /** The window lost focus mid-press, so no release will arrive: undo whatever the press borrowed. */
  cancel: () => void;
}

export type CommandRegistry = Partial<Record<CommandId, CommandDefinition>>;
