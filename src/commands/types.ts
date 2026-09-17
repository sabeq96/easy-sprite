import type { CommandGroup, CommandId } from "@/constants/commands";

export interface CommandDefinition {
  id: CommandId;
  /** Shown in menus, tooltips and the cheat sheet — one source of truth for wording. */
  label: string;
  group: CommandGroup;
  /** Computed at read time; surfaces dim disabled commands rather than hiding them. */
  isEnabled?: () => boolean;
  isActive?: () => boolean;
  run: () => void;
}

export type CommandRegistry = Partial<Record<CommandId, CommandDefinition>>;
