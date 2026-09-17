import type { CommandId } from "@/constants/commands";
import { bindingSignature, formatBinding, type KeyBinding } from "@/lib/keys";

/**
 * The single source of truth for the keymap. Every entry maps to a command id, not a handler,
 * so a shortcut for a command that does not exist is a type error.
 */
export const SHORTCUTS: Partial<Record<CommandId, KeyBinding[]>> = {
  "tool.pencil": [{ key: "p" }],
  "tool.eraser": [{ key: "e" }],
  "tool.bucket": [{ key: "b" }],
  "tool.fillSimilar": [{ key: "g" }],
  "tool.picker": [{ key: "o" }],
  "tool.select": [{ key: "s" }],
  "tool.move": [{ key: "m" }],

  "edit.undo": [{ key: "z", mod: true }],
  "edit.redo": [{ key: "z", mod: true, shift: true }, { key: "y", mod: true }],
  "edit.copy": [{ key: "c", mod: true }],
  "edit.cut": [{ key: "x", mod: true }],
  "edit.paste": [{ key: "v", mod: true }],
  "edit.selectAll": [{ key: "a", mod: true }],
  "edit.deselect": [{ key: "escape" }],
  "edit.deleteSelection": [{ key: "delete" }, { key: "backspace" }],
  "edit.save": [{ key: "s", mod: true }],

  "color.swap": [{ key: "x" }],
  "color.reset": [{ key: "d" }],

  "frame.add": [{ key: "n" }],
  "frame.duplicate": [{ key: "n", shift: true }],
  "frame.previous": [{ key: "," }],
  "frame.next": [{ key: "." }],
  "frame.moveLeft": [{ key: ",", alt: true }],
  "frame.moveRight": [{ key: ".", alt: true }],

  "layer.add": [{ key: "n", mod: true, shift: true }],
  "layer.mergeDown": [{ key: "e", mod: true }],
  "layer.selectAbove": [{ key: "pageup" }],
  "layer.selectBelow": [{ key: "pagedown" }],

  "view.zoomIn": [{ key: "+" }, { key: "=" }],
  "view.zoomOut": [{ key: "-" }, { key: "_" }],
  "view.fit": [{ key: "0" }],
  "view.toggleGrid": [{ key: "g", mod: true }],
  "view.toggleOnion": [{ key: "o", mod: true, shift: true }],

  "app.shortcutHelp": [{ key: "?" }],
  "app.backToLibrary": [{ key: "escape", shift: true }],
};

/** Keys held to temporarily swap tools, released back to the previous tool. */
export const HELD_TOOL_KEYS = { Alt: "picker" } as const;

/** The first bound chord for a command, formatted for a tooltip — reads the one keymap table. */
export function shortcutHint(commandId: CommandId): string | undefined {
  const binding = SHORTCUTS[commandId]?.[0];
  return binding && formatBinding(binding);
}

// Dev-only guard: two features must never silently claim the same chord.
if (import.meta.env.DEV) {
  const seen = new Map<string, CommandId>();
  for (const [commandId, bindings] of Object.entries(SHORTCUTS)) {
    for (const binding of bindings ?? []) {
      const signature = bindingSignature(binding);
      const existing = seen.get(signature);
      if (existing) {
        console.error(`Duplicate shortcut "${signature}": ${existing} and ${commandId}`);
      }
      seen.set(signature, commandId as CommandId);
    }
  }
}
