import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SaveStatus } from "@/services/autosave";
import { cn } from "@/lib/utils";

const LABELS: Record<SaveStatus, string> = {
  idle: "Saved",
  pending: "Unsaved changes",
  saving: "Saving…",
  error: "Save failed",
};

// Two colors keep this legible at a glance; the tooltip carries the exact status.
const DOT_COLOR: Record<SaveStatus, string> = {
  idle: "bg-emerald-500",
  pending: "bg-destructive",
  saving: "bg-destructive animate-pulse",
  error: "bg-destructive",
};

export function SaveStatusBadge({ status }: { status: SaveStatus }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="status"
            tabIndex={0}
            aria-label={LABELS[status]}
            className={cn(
              "inline-flex size-2.5 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              DOT_COLOR[status],
            )}
          />
        }
      />
      <TooltipContent side="bottom">{LABELS[status]}</TooltipContent>
    </Tooltip>
  );
}
