import { createContext, useContext } from "react";
import type { CommandDefinition, CommandRegistry } from "@/commands/types";
import type { CommandId } from "@/commands/types";

const CommandsContext = createContext<CommandRegistry | null>(null);

/** Provided once by the editor shell, so any control can bind to a command by id. */
export const CommandsProvider = CommandsContext;

export function useCommand(id: CommandId): CommandDefinition {
  const command = useContext(CommandsContext)?.[id];
  if (!command) throw new Error(`Command "${id}" is not registered`);
  return command;
}
