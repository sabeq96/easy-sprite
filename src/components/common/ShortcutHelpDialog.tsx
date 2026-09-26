import { hintRow, type HintSection, type ShortcutRow } from "@/commands/hints";
import { commandKeys, SHORTCUTS } from "@/commands/keymap";
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

export interface ShortcutSection {
  title: string;
  rows: ShortcutRow[];
}

export interface ShortcutHelpDialogProps {
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
 * Generated entirely from what a page registers — its commands, the keymap and its feature hints
 * — so nothing here can go stale when a key or gesture changes.
 */
export function ShortcutHelpDialog({
  commands,
  open,
  onOpenChange,
  description,
  hints,
  leadingSections = [],
  excludeCommands,
}: ShortcutHelpDialogProps) {
  const groups = new Map<CommandGroup, ShortcutRow[]>();

  for (const commandId of Object.keys(SHORTCUTS) as CommandId[]) {
    const command = commands[commandId];
    const keys = commandKeys(commandId);
    if (!command || keys.length === 0 || excludeCommands?.has(commandId)) continue;

    const rows = groups.get(command.group) ?? [];
    rows.push({ label: command.label, keys });
    groups.set(command.group, rows);
  }

  for (const { group, hints: groupHints } of hints) {
    groups.set(group, [...(groups.get(group) ?? []), ...groupHints.map(hintRow)]);
  }

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

            {[...groups.entries()].map(([group, rows]) => (
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
