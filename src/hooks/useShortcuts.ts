import { useEffect } from "react";
import type { CommandRegistry } from "@/commands/types";
import type { CommandId } from "@/commands/types";
import { SHORTCUTS } from "@/commands/keymap";
import { isTypingTarget, matchesBinding } from "@/lib/keys";

/** Keys that should keep firing while held. */
const REPEATABLE = new Set(["+", "=", "-", ",", "."]);

/**
 * Runs whichever command in `commands` a key is bound to. Editor-agnostic: a page passes only
 * the commands it has, and a key bound to a command it lacks is left to the browser.
 */
export function useShortcuts(commands: CommandRegistry): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat && !REPEATABLE.has(event.key)) return;
      if (isTypingTarget(event.target) && event.key !== "Escape") return;

      for (const [commandId, bindings] of Object.entries(SHORTCUTS)) {
        if (!bindings?.some((binding) => matchesBinding(event, binding))) continue;

        const command = commands[commandId as CommandId];
        if (!command || command.isEnabled?.() === false) return;

        // preventDefault only after a real match, so the browser keeps every other key.
        event.preventDefault();
        command.run();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commands]);
}
