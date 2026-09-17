import type { CommandRegistry } from "@/commands/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CommandGroup, CommandId } from "@/constants/commands";
import { SHORTCUTS } from "@/constants/shortcuts";
import { formatBinding } from "@/lib/keys";

export interface ShortcutHelpDialogProps {
  commands: CommandRegistry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Rendered from the same SHORTCUTS table the handler reads, so the two cannot disagree. */
export function ShortcutHelpDialog({ commands, open, onOpenChange }: ShortcutHelpDialogProps) {
  const groups = new Map<CommandGroup, { label: string; keys: string[] }[]>();

  for (const [commandId, bindings] of Object.entries(SHORTCUTS)) {
    const command = commands[commandId as CommandId];
    if (!command || !bindings?.length) continue;

    const entries = groups.get(command.group) ?? [];
    entries.push({ label: command.label, keys: bindings.map(formatBinding) });
    groups.set(command.group, entries);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Hold <Kbd>Alt</Kbd> with any drawing tool to pick a colour, then release to go back.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="grid gap-4 sm:grid-cols-2">
            {[...groups.entries()].map(([group, entries]) => (
              <section key={group}>
                <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
                  {group}
                </h3>
                <ul className="flex flex-col gap-1">
                  {entries.map((entry) => (
                    <li key={entry.label} className="flex items-center justify-between gap-2">
                      <span className="text-sm">{entry.label}</span>
                      <KbdGroup>
                        {entry.keys.map((key) => (
                          <Kbd key={key}>{key}</Kbd>
                        ))}
                      </KbdGroup>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <section>
              <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
                Colors
              </h3>
              <ul className="flex flex-col gap-1">
                <li className="flex items-center justify-between gap-2">
                  <span className="text-sm">Pick palette slot 1–9</span>
                  <Kbd>1…9</Kbd>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-sm">Pick as secondary</span>
                  <Kbd>⇧1…9</Kbd>
                </li>
              </ul>
            </section>

            <section>
              <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
                Canvas
              </h3>
              <ul className="flex flex-col gap-1">
                <li className="flex items-center justify-between gap-2">
                  <span className="text-sm">Pan</span>
                  <Kbd>Space + drag</Kbd>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-sm">Zoom</span>
                  <Kbd>Scroll</Kbd>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-sm">Draw with secondary colour</span>
                  <Kbd>Right-drag</Kbd>
                </li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
