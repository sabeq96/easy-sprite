/** Every command that is not "activate tool X" — those are derived from the tool registry. */
const APP_COMMAND_IDS = [
  // tools
  "tool.cycleBrushSize",
  // edit
  "edit.undo",
  "edit.redo",
  "edit.copy",
  "edit.cut",
  "edit.paste",
  "edit.selectAll",
  "edit.deselect",
  "edit.deleteSelection",
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
 * `@/commands/types`) adds one `tool.<id>` per registered tool.
 */
export type AppCommandId = (typeof APP_COMMAND_IDS)[number];

export type CommandGroup = "Tools" | "Edit" | "Color" | "Layers" | "Frames" | "View" | "App";
