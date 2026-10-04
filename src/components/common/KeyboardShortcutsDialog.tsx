import { hintRow, type HintSection, type ShortcutRow } from "@/commands/hints";
import { keysOf } from "@/commands/keymap";
import type { CommandRegistry } from "@/commands/types";
import { ShortcutList } from "@/components/common/ShortcutList";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { COMMAND_GROUPS, type CommandGroup } from "@/constants/commands";

export interface ShortcutSection {
  title: string;
  rows: ShortcutRow[];
}

export interface KeyboardShortcutsDialogProps {
  commands: CommandRegistry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  /** Inputs owned by features rather than commands; each joins the command group it names. */
  hints: readonly HintSection[];
  /** Sections shown before the command groups, e.g. the pixel editor's tools. */
  leadingSections?: readonly ShortcutSection[];
  /** Commands listed in a leading section instead of their group. */
  excludeCommands?: ReadonlySet<string>;
}

/**
 * Generated entirely from what a page registers — its commands with their keys, and its feature
 * hints — so nothing here can go stale when a key or gesture changes. Groups follow
 * `COMMAND_GROUPS`; rows follow registry order, then the hints.
 */
export function KeyboardShortcutsDialog({
  commands,
  open,
  onOpenChange,
  description,
  hints,
  leadingSections = [],
  excludeCommands,
}: KeyboardShortcutsDialogProps) {
  const rowsByGroup = new Map<CommandGroup, ShortcutRow[]>();

  for (const command of Object.values(commands)) {
    const keys = keysOf(command);
    if (!command || keys.length === 0 || excludeCommands?.has(command.id)) continue;

    const rows = rowsByGroup.get(command.group) ?? [];
    rows.push({ label: command.label, keys });
    rowsByGroup.set(command.group, rows);
  }

  for (const { group, hints: groupHints } of hints) {
    rowsByGroup.set(group, [...(rowsByGroup.get(group) ?? []), ...groupHints.map(hintRow)]);
  }

  const groups = COMMAND_GROUPS.flatMap((group) => {
    const rows = rowsByGroup.get(group);
    return rows ? [{ group, rows }] : [];
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-3xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="grid gap-4 pr-4 sm:grid-cols-2">
            {leadingSections.map((section) => (
              <Section key={section.title} title={section.title} rows={section.rows} />
            ))}

            {groups.map(({ group, rows }) => (
              <Section key={group} title={group} rows={rows} />
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, rows }: ShortcutSection) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
        {title}
      </h3>
      <ShortcutList rows={rows} />
    </section>
  );
}
