import { hintRow, type ShortcutRow } from "@/commands/hints";
import { commandKeys, SHORTCUTS, toolKeys } from "@/commands/keymap";
import type { CommandId, CommandRegistry } from "@/commands/types";
import { ShortcutList } from "@/components/common/ShortcutList";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CommandGroup } from "@/constants/commands";
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
function toolSections(commands: CommandRegistry) {
  return TOOL_LIST.flatMap((tool) => {
    const rows: ShortcutRow[] = (tool.commands ?? []).flatMap((id) => {
      const command = commands[id];
      return command ? [{ label: command.label, keys: commandKeys(id) }] : [];
    });
    rows.push(...(tool.hints ?? []).map(hintRow));
    return rows.length > 0 ? [{ id: tool.id, title: tool.label, rows }] : [];
  });
}

/**
 * Generated entirely from what features declare — the keymap, each tool's commands and hints,
 * and the feature hint lists — so nothing here can go stale when a key or gesture changes.
 */
export function ShortcutHelpDialog({
  commands,
  open,
  onOpenChange,
}: ShortcutHelpDialogProps) {
  const groups = new Map<CommandGroup, ShortcutRow[]>();

  for (const commandId of Object.keys(SHORTCUTS) as CommandId[]) {
    const command = commands[commandId];
    const keys = commandKeys(commandId);
    if (!command || keys.length === 0 || TOOL_OWNED_COMMANDS.has(commandId))
      continue;

    const rows = groups.get(command.group) ?? [];
    rows.push({ label: command.label, keys });
    groups.set(command.group, rows);
  }

  for (const { group, hints } of FEATURE_HINTS) {
    groups.set(group, [...(groups.get(group) ?? []), ...hints.map(hintRow)]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-3xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Every key and mouse gesture the editor understands.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="grid gap-4 pr-4 sm:grid-cols-2">
            <Section title="Tools" rows={TOOLS_ROWS} />

            {toolSections(commands).map((tool) => (
              <Section key={tool.id} title={tool.title} rows={tool.rows} />
            ))}

            {[...groups.entries()].map(([group, rows]) => (
              <Section key={group} title={group} rows={rows} />
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, rows }: { title: string; rows: ShortcutRow[] }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
        {title}
      </h3>
      <ShortcutList rows={rows} />
    </section>
  );
}
