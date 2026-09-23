import { formatHint, type Hint } from "@/commands/hints";
import { Kbd } from "@/components/ui/kbd";

/** The one renderer for hints — the shortcut sheet and hover cards both use it. */
export function HintList({ hints }: { hints: readonly Hint[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {hints.map((hint, index) => (
        // Actions repeat when there are two ways to do them ("Pan": Space+drag or middle-drag).
        <li key={index} className="flex items-center justify-between gap-3">
          <span className="text-sm">
            {hint.action}
            {hint.where && <span className="opacity-60"> · {hint.where}</span>}
          </span>
          <Kbd>{formatHint(hint)}</Kbd>
        </li>
      ))}
    </ul>
  );
}
