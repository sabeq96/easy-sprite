import type { CommandHold, CommandId, CommandRegistry } from "@/commands/types";
import type { CommandGroup } from "@/constants/commands";
import type { KeyBinding } from "@/lib/keys";

/**
 * One command a page declares, with its keys. Static: the page binds it to its context, and
 * handlers read whatever stores they need when they run.
 */
export interface CommandSpec<Id extends string, Ctx> {
  readonly id: Id;
  readonly label: string;
  readonly group: CommandGroup;
  /** The chords that run this command; the active registry is the keymap. */
  readonly keys?: readonly KeyBinding[];
  isEnabled?(ctx: Ctx): boolean;
  isActive?(ctx: Ctx): boolean;
  run(ctx: Ctx): void;
  /** A key bound to this command reports its press and release here instead of calling `run`. */
  hold?(ctx: Ctx): CommandHold;
}

/** A `defineCommands` for one context type: it keeps each definition's literal id. */
export function commandsFor<Ctx>() {
  return <const Id extends string>(
    commands: readonly CommandSpec<Id, Ctx>[],
  ): readonly CommandSpec<Id, Ctx>[] => commands;
}

/** The registry entries for `commands`, each bound to `ctx`, in order. */
export function bindCommands<Ctx>(
  commands: readonly CommandSpec<string, Ctx>[],
  ctx: Ctx,
): CommandRegistry {
  const registry: CommandRegistry = {};
  for (const command of commands) {
    // Every declared id is part of `CommandId`, which is derived from these definitions.
    const id = command.id as CommandId;
    registry[id] = {
      id,
      label: command.label,
      group: command.group,
      keys: command.keys,
      isEnabled: command.isEnabled && (() => command.isEnabled?.(ctx) ?? true),
      isActive: command.isActive && (() => command.isActive?.(ctx) ?? false),
      run: () => command.run(ctx),
      hold: command.hold?.(ctx),
    };
  }
  return registry;
}
