import type { BuilderCommandId } from "@/commands/builderCommands";
import type { CommandGroup } from "@/constants/commands";
import type { ModuleCommandId } from "@/editor/modules";
import type { KeyBinding } from "@/lib/keys";
import type { ContributedCommandId, SettingCommandId, ToolId } from "@/tools";

export type ToolCommandId = `tool.${ToolId}`;
/**
 * One activation command per tool, the commands tools contribute, the ones the host generates
 * from their settings, every host module's commands and the Builder's. All derived
 * from their definitions.
 */
export type CommandId =
  | ToolCommandId
  | ContributedCommandId
  | SettingCommandId
  | ModuleCommandId
  | BuilderCommandId;

export interface CommandDefinition {
  id: CommandId;
  /** Shown in menus, tooltips and the cheat sheet — one source of truth for wording. */
  label: string;
  group: CommandGroup;
  /** The chords that run this command; read by useShortcuts, tooltips and the cheat sheet. */
  keys?: readonly KeyBinding[];
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

/** The active commands by id: the keymap, the cheat sheet and every bound control read it. */
export type CommandRegistry = Partial<Record<CommandId, CommandDefinition>>;
