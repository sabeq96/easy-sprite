import { useDocumentSession } from "@/app/DocumentProvider";
import type { Command } from "@/editor/history";

/**
 * Runs a command factory — which applies its own change — and records it for undo.
 * Factories return null for a no-op, and callers can ignore that.
 */
export function useCommandDispatch(): (factory: () => Command | null) => boolean {
  const { history } = useDocumentSession();

  return (factory) => {
    const command = factory();
    if (command) history.push(command);
    return command !== null;
  };
}
