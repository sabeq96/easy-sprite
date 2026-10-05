import type { ShortcutRow } from "@/commands/hints";
import { hintRow } from "@/commands/hints";
import { keysOf, reselectKeys } from "@/commands/keymap";
import type { CommandId, CommandRegistry } from "@/commands/types";
import {
  KeyboardShortcutsDialog as CommonKeyboardShortcutsDialog,
  type ShortcutSection,
} from "@/components/common/KeyboardShortcutsDialog";
import { EDITOR_MODULES } from "@/editor/modules";
import { reselectLabel, TOOL_KEY_HOLD_HINT } from "@/editor/toolbox/api";
import { TOOL_LIST } from "@/tools";

export interface KeyboardShortcutsDialogProps {
  commands: CommandRegistry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Commands listed with their tool rather than in their group: each tool's activation key (in the
 * Tools section) and the commands a tool contributes (the selection's copy, cut, …).
 */
const TOOL_OWNED_COMMANDS = new Set<string>(
  TOOL_LIST.flatMap((tool) => [
    `tool.${tool.id}`,
    ...(tool.commands ?? []).map(({ id }) => id),
  ]),
);

/**
 * Tools-group commands that aren't a tool's own key or contributed command (the commands its
 * settings declare, such as the mirror toggle): shown under Tools too.
 */
function toolsGroupCommands(commands: CommandRegistry): CommandId[] {
  return (Object.keys(commands) as CommandId[]).filter(
    (id) =>
      commands[id]?.group === "Tools" &&
      !TOOL_OWNED_COMMANDS.has(id) &&
      keysOf(commands[id]).length > 0,
  );
}

/**
 * Inputs owned by host modules rather than commands, each declared by its module. They join the
 * command group they belong to instead of getting sections of their own.
 */
const MODULE_HINTS = EDITOR_MODULES.flatMap((editorModule) => editorModule.hints ?? []);

/**
 * One row per tool, each followed by what pressing its key again does; then the other Tools
 * commands, and last the hold gesture every tool key shares.
 */
function toolsRows(commands: CommandRegistry): ShortcutRow[] {
  const rows = TOOL_LIST.flatMap((tool) => {
    const row = { label: tool.label, keys: keysOf(commands[`tool.${tool.id}`]) };
    const reselect = reselectLabel(tool);
    return reselect ? [row, { label: reselect, keys: reselectKeys(tool, commands) }] : [row];
  });
  for (const id of toolsGroupCommands(commands)) {
    rows.push({ label: commands[id]?.label ?? id, keys: keysOf(commands[id]) });
  }
  rows.push(hintRow(TOOL_KEY_HOLD_HINT));
  return rows;
}

/**
 * Only tools with more to say than their key — their commands and hints — get a section, read
 * from the tool's own definitions so Keyboard shortcuts cannot drift from them.
 */
function toolSections(commands: CommandRegistry): ShortcutSection[] {
  return TOOL_LIST.flatMap((tool) => {
    const rows: ShortcutRow[] = (tool.commands ?? []).map((command) => ({
      label: command.label,
      keys: keysOf(commands[command.id as CommandId]),
    }));
    rows.push(...(tool.hints ?? []).map(hintRow));
    return rows.length > 0 ? [{ title: tool.label, rows }] : [];
  });
}

/** The Editor's Keyboard shortcuts: its tools first, then the shared command groups. */
export function KeyboardShortcutsDialog({
  commands,
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <CommonKeyboardShortcutsDialog
      commands={commands}
      open={open}
      onOpenChange={onOpenChange}
      description="Every key and mouse gesture the editor understands."
      hints={MODULE_HINTS}
      leadingSections={[{ title: "Tools", rows: toolsRows(commands) }, ...toolSections(commands)]}
      excludeCommands={new Set([...TOOL_OWNED_COMMANDS, ...toolsGroupCommands(commands)])}
    />
  );
}
