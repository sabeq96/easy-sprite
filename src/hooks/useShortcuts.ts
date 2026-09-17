import { useEffect } from "react";
import type { CommandRegistry } from "@/commands/types";
import type { CommandId } from "@/constants/commands";
import { HELD_TOOL_KEYS, SHORTCUTS } from "@/constants/shortcuts";
import type { ToolId } from "@/constants/tools";
import { isTypingTarget, matchesBinding } from "@/lib/keys";
import { useEditorStore } from "@/stores/useEditorStore";

/** Keys that should keep firing while held. */
const REPEATABLE = new Set(["+", "=", "-", ",", "."]);

export function useShortcuts(commands: CommandRegistry): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat && !REPEATABLE.has(event.key)) return;
      if (isTypingTarget(event.target) && event.key !== "Escape") return;

      // Hold Alt for a temporary eyedropper, exactly like Piskel.
      const heldTool = HELD_TOOL_KEYS[event.key as keyof typeof HELD_TOOL_KEYS];
      if (heldTool) {
        useEditorStore.getState().pushTemporaryTool(heldTool as ToolId);
        return;
      }

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

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key in HELD_TOOL_KEYS) useEditorStore.getState().popTemporaryTool();
    };

    // Releasing a held modifier outside the window would otherwise leave the tool stuck.
    const onBlur = () => useEditorStore.getState().popTemporaryTool();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [commands]);
}
