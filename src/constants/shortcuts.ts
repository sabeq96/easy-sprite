import type { KeyBinding } from "@/lib/keys";

/** The view commands both the pixel editor and the spritesheet composer declare, over their own stores. */
export type SharedViewCommandId = "view.zoomIn" | "view.zoomOut" | "view.fit" | "view.toggleGrid";

/**
 * The keys of the shared view commands, so the two surfaces cannot drift apart. The session commands
 * (undo, redo, save, help, back) are defined once in `@/commands/session`; every other command
 * declares its keys on its own definition.
 */
export const SHARED_KEYS: Readonly<Record<SharedViewCommandId, readonly KeyBinding[]>> = {
  "view.zoomIn": [{ key: "+" }, { key: "=" }],
  "view.zoomOut": [{ key: "-" }, { key: "_" }],
  "view.fit": [{ key: "0" }],
  "view.toggleGrid": [{ key: "g", mod: true }],
};

/** A tool key held at least this long borrows the tool; a shorter press switches to it for good. */
export const TOOL_KEY_HOLD_MS = 300;
