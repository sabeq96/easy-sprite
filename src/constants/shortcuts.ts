import type { KeyBinding } from "@/lib/keys";

/** The commands both the pixel editor and the spritesheet composer offer, under the same ids. */
export type SharedCommandId =
  | "edit.undo"
  | "edit.redo"
  | "edit.save"
  | "view.zoomIn"
  | "view.zoomOut"
  | "view.fit"
  | "view.toggleGrid"
  | "app.shortcutHelp"
  | "app.backToLibrary";

/**
 * The keys of the shared commands, so the two surfaces cannot drift apart. Every other command
 * declares its keys on its own definition.
 */
export const SHARED_KEYS: Readonly<Record<SharedCommandId, readonly KeyBinding[]>> = {
  "edit.undo": [{ key: "z", mod: true }],
  "edit.redo": [{ key: "z", mod: true, shift: true }, { key: "y", mod: true }],
  "edit.save": [{ key: "s", mod: true }],

  "view.zoomIn": [{ key: "+" }, { key: "=" }],
  "view.zoomOut": [{ key: "-" }, { key: "_" }],
  "view.fit": [{ key: "0" }],
  "view.toggleGrid": [{ key: "g", mod: true }],

  "app.shortcutHelp": [{ key: "?" }],
  "app.backToLibrary": [{ key: "escape", shift: true }],
};

/** A tool key held at least this long borrows the tool; a shorter press switches to it for good. */
export const TOOL_KEY_HOLD_MS = 300;
