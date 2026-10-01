/**
 * Every command the app itself owns. "Activate tool X", the commands a tool contributes (the
 * selection's copy, cut, …) and its settings' commands (mirror) are derived from the tool
 * registry instead.
 */
const APP_COMMAND_IDS = [
  // edit
  "edit.undo",
  "edit.redo",
  "edit.save",
  // color
  "color.swap",
  "color.reset",
  // layers
  "layer.add",
  "layer.duplicate",
  "layer.delete",
  "layer.mergeDown",
  "layer.selectAbove",
  "layer.selectBelow",
  // frames
  "frame.add",
  "frame.duplicate",
  "frame.delete",
  "frame.previous",
  "frame.next",
  "frame.moveLeft",
  "frame.moveRight",
  // view
  "view.zoomIn",
  "view.zoomOut",
  "view.fit",
  "view.toggleGrid",
  "view.toggleOnion",
  // app
  "app.shortcutHelp",
  "app.backToLibrary",
] as const;

/**
 * Commands that exist independently of the tool registry. The full `CommandId` (in
 * `@/commands/types`) adds one `tool.<id>` per registered tool, and the tools' own commands.
 */
export type AppCommandId = (typeof APP_COMMAND_IDS)[number];

export type CommandGroup = "Tools" | "Edit" | "Color" | "Layers" | "Frames" | "View" | "App";
