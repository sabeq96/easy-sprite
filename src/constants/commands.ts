/**
 * Every command group, in the order the shortcut sheet lists them. Command ids are not listed
 * here: they are derived from the definitions that declare them (`@/commands/types`).
 */
export const COMMAND_GROUPS = [
  "Tools",
  "Edit",
  "Color",
  "Frames",
  "Layers",
  "View",
  "App",
] as const;

export type CommandGroup = (typeof COMMAND_GROUPS)[number];
