import type { ShortcutRow } from "@/commands/hints";
import { hintRow } from "@/commands/hints";
import { commandKeys, toolKeys } from "@/commands/keymap";
import type { CommandRegistry } from "@/commands/types";
import {
  ShortcutHelpDialog as CommonShortcutHelpDialog,
  type ShortcutSection,
} from "@/components/common/ShortcutHelpDialog";
import { TOOL_LIST } from "@/editor/tools";
import { CANVAS_VIEW_HINTS } from "@/hooks/useCanvasViewControls";
import { COLOR_HOTKEY_HINTS } from "@/hooks/useColorHotkeys";
import { POINTER_PAINT_HINTS } from "@/hooks/usePointerPaint";

export interface ShortcutHelpDialogProps {
  commands: CommandRegistry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Commands listed with their tool rather than in their group: each tool's activation key (in the
 * Tools section) and the commands a tool claims (the selection's copy, cut, …).
 */
const TOOL_OWNED_COMMANDS = new Set<string>(
  TOOL_LIST.flatMap((tool) => [`tool.${tool.id}`, ...(tool.commands ?? [])]),
);

/**
 * Inputs owned by features rather than commands, each declared next to its code. They join the
 * command group they belong to instead of getting sections of their own.
 */
const FEATURE_HINTS = [COLOR_HOTKEY_HINTS, POINTER_PAINT_HINTS, CANVAS_VIEW_HINTS];

/** One row per tool: its key, plus the key held to borrow it from any other tool. */
const TOOLS_ROWS: ShortcutRow[] = TOOL_LIST.map((tool) => ({
  label: tool.label,
  keys: toolKeys(tool),
}));

/** Only tools with more to say than their key — their commands and hints — get a section. */
function toolSections(commands: CommandRegistry): ShortcutSection[] {
  return TOOL_LIST.flatMap((tool) => {
    const rows: ShortcutRow[] = (tool.commands ?? []).flatMap((id) => {
      const command = commands[id];
      return command ? [{ label: command.label, keys: commandKeys(id) }] : [];
    });
    rows.push(...(tool.hints ?? []).map(hintRow));
    return rows.length > 0 ? [{ title: tool.label, rows }] : [];
  });
}

/** The pixel editor's sheet: its tools first, then the shared command groups. */
export function ShortcutHelpDialog({ commands, open, onOpenChange }: ShortcutHelpDialogProps) {
  return (
    <CommonShortcutHelpDialog
      commands={commands}
      open={open}
      onOpenChange={onOpenChange}
      description="Every key and mouse gesture the editor understands."
      hints={FEATURE_HINTS}
      leadingSections={[{ title: "Tools", rows: TOOLS_ROWS }, ...toolSections(commands)]}
      excludeCommands={TOOL_OWNED_COMMANDS}
    />
  );
}
