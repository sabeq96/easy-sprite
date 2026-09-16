import { Badge } from "@/components/ui/badge";
import type { SaveStatus } from "@/services/autosave";

const LABELS: Record<SaveStatus, string> = {
  idle: "Saved",
  pending: "Unsaved changes",
  saving: "Saving…",
  error: "Save failed",
};

export function SaveStatusBadge({ status }: { status: SaveStatus }) {
  return (
    <Badge variant={status === "error" ? "destructive" : "secondary"} aria-live="polite">
      {LABELS[status]}
    </Badge>
  );
}
