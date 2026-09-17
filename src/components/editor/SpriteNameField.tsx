import { useState } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { Input } from "@/components/ui/input";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";

export function SpriteNameField() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    const next = draft?.trim();
    if (next && next !== snapshot.name) doc.setMeta({ name: next });
    setDraft(null);
  };

  return (
    <Input
      aria-label="Sprite name"
      className="h-7 w-48 border-transparent bg-transparent hover:border-border focus:border-border"
      value={draft ?? snapshot.name}
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
