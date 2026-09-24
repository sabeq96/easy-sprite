import type { ShortcutRow } from "@/commands/hints";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

/** Label on the left, its chords on the right — the shortcut sheet and hover cards share it. */
export function ShortcutList({ rows }: { rows: readonly ShortcutRow[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((row) => (
        // Labels repeat when there are two ways to do one thing ("Pan"), so the chords are in the key.
        <li key={`${row.label}:${row.keys.join("+")}`} className="flex items-center justify-between gap-3">
          <span className="text-sm">{row.label}</span>
          <KbdGroup>
            {row.keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
        </li>
      ))}
    </ul>
  );
}
