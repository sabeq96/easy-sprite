import { createContext, useContext, useSyncExternalStore } from "react";
import type { CommandDefinition, CommandRegistry } from "@/commands/types";
import type { CommandId } from "@/commands/types";

/** Registers a listener for every store a command's `isActive` or `isEnabled` may read. */
export type CommandStateSubscribe = (listener: () => void) => () => void;

export interface CommandsValue {
  registry: CommandRegistry;
  /** Bound controls re-read a command's state whenever this notifies. */
  subscribe: CommandStateSubscribe;
}

const CommandsContext = createContext<CommandsValue | null>(null);

/** Provided once by each editor's shell, so any control can bind to a command by id. */
export const CommandsProvider = CommandsContext;

function useRegistered(id: CommandId): { command: CommandDefinition; subscribe: CommandStateSubscribe } {
  const value = useContext(CommandsContext);
  const command = value?.registry[id];
  if (!value || !command) throw new Error(`Command "${id}" is not registered`);
  return { command, subscribe: value.subscribe };
}

export function useCommand(id: CommandId): CommandDefinition {
  return useRegistered(id).command;
}

export interface CommandState {
  isActive: boolean;
  isEnabled: boolean;
}

/** A command's pressed and enabled state, re-read whenever the provider's stores change. */
export function useCommandState(id: CommandId): CommandState {
  const { command, subscribe } = useRegistered(id);
  const isActive = useSyncExternalStore(subscribe, () => command.isActive?.() ?? false);
  const isEnabled = useSyncExternalStore(subscribe, () => command.isEnabled?.() ?? true);
  return { isActive, isEnabled };
}
