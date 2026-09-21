import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface InlineNameFieldProps {
  label: string;
  name: string;
  onCommit: (name: string) => void;
  className?: string;
}

/**
 * The borderless title field in a document header: edits live in a local draft, commit on blur
 * or Enter, and revert on Escape. A blank name commits nothing, so a document can never be left
 * nameless by a stray select-all.
 */
export function InlineNameField({ label, name, onCommit, className }: InlineNameFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    const next = draft?.trim();
    if (next && next !== name) onCommit(next);
    setDraft(null);
  };

  return (
    <Input
      aria-label={label}
      ghost
      className={cn("h-7 w-48", className)}
      value={draft ?? name}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        // Typing must never reach the global shortcut handler.
        event.stopPropagation();
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(null);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
