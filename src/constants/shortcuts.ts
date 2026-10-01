import type { AppCommandId } from "@/constants/commands";
import type { KeyBinding } from "@/lib/keys";

/**
 * Every key that is not a tool's. Entries map to a command id, not a handler, so a shortcut for a
 * command that does not exist is a type error. Tool keys live on the tool (`Tool.shortcut`,
 * `keys` on each command in `Tool.commands`, and on each setting's `command`);
 * `@/commands/keymap` merges them all.
 */
export const APP_SHORTCUTS: Partial<Record<AppCommandId, KeyBinding[]>> = {
  "edit.undo": [{ key: "z", mod: true }],
  "edit.redo": [{ key: "z", mod: true, shift: true }, { key: "y", mod: true }],
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

/** A tool key held at least this long borrows the tool; a shorter press switches to it for good. */
export const TOOL_KEY_HOLD_MS = 300;
