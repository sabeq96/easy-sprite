export const COMMAND_IDS = [
  // tools
  "tool.pencil",
  "tool.eraser",
  "tool.bucket",
  "tool.fillSimilar",
  "tool.picker",
  "tool.select",
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

export type CommandId = (typeof COMMAND_IDS)[number];

export type CommandGroup = "Tools" | "Edit" | "Color" | "Layers" | "Frames" | "View" | "App";
