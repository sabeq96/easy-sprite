import { useEffect, useRef } from "react";
import type { CommandDefinition, CommandRegistry } from "@/commands/types";
import type { CommandId } from "@/commands/types";
import { SHORTCUTS } from "@/commands/keymap";
import { isTypingTarget, matchesBinding } from "@/lib/keys";

/** Keys that should keep firing while held. */
const REPEATABLE = new Set(["+", "=", "-", ",", "."]);

/**
 * Runs whichever command in `commands` a key is bound to. Editor-agnostic: a page passes only
 * the commands it has, and a key bound to a command it lacks is left to the browser. A command
 * with a `hold` part (the tool keys) is told about the press and, later, its release instead.
 */
export function useShortcuts(commands: CommandRegistry): void {
  // Kept in a ref so a new registry (every render that switches tools) does not re-subscribe,
  // which would cancel the very hold whose press just switched the tool.
  const commandsRef = useRef(commands);
  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]);

  useEffect(() => {
    // Keyed by `event.code`: a held letter's `event.key` changes if Shift or Option joins mid-hold.
    const pressed = new Map<string, CommandDefinition>();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat && !REPEATABLE.has(event.key)) return;
      if (isTypingTarget(event.target) && event.key !== "Escape") return;

      for (const [commandId, bindings] of Object.entries(SHORTCUTS)) {
        if (!bindings?.some((binding) => matchesBinding(event, binding))) continue;

        const command = commandsRef.current[commandId as CommandId];
        if (!command || command.isEnabled?.() === false) return;

        // preventDefault only after a real match, so the browser keeps every other key.
        event.preventDefault();
        if (command.hold) {
          command.hold.press({ code: event.code, at: event.timeStamp });
          pressed.set(event.code, command);
        } else {
          command.run();
        }
        return;
      }
    };

    // Not filtered by target: a release that lands after focus moved into a field still counts.
    const onKeyUp = (event: KeyboardEvent) => {
      const command = pressed.get(event.code);
      if (!command) return;
      pressed.delete(event.code);
      command.hold?.release({ code: event.code, at: event.timeStamp });
    };

    // A key released outside the window never reports its keyup.
    const cancelAll = () => {
      for (const command of pressed.values()) command.hold?.cancel();
      pressed.clear();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", cancelAll);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", cancelAll);
      cancelAll();
    };
  }, []);
}
