import { Copy, Trash2 } from "lucide-react";
import { TooltipButton } from "@/components/common/TooltipButton";
import { FrameThumbnail } from "@/components/editor/FrameThumbnail";
import { Button } from "@/components/ui/button";
import { shortcutHint } from "@/constants/shortcuts";
import { useSortableItem } from "@/hooks/useDnd";
import { cn } from "@/lib/utils";

export interface FrameCardProps {
  frameId: string;
  index: number;
  isActive: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function FrameCard({
  frameId,
  index,
  isActive,
  canDelete,
  onSelect,
  onDuplicate,
  onDelete,
}: FrameCardProps) {
  const { dragProps, dragClass } = useSortableItem(frameId, { index, collision: "nearest" });

  return (
    // The <li> itself is the sortable: optimistic sorting moves the list's direct children.
    <li
      {...dragProps}
      className={cn(
        "group relative rounded-lg p-1 transition-colors",
        isActive ? "bg-primary/10 shadow-sm" : "hover:bg-muted/50",
        dragClass,
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Frame ${index + 1}`}
        aria-pressed={isActive}
        className="block"
      >
        <FrameThumbnail frameId={frameId} />
      </button>

      <span className="absolute bottom-1 left-1.5 text-[10px] tabular-nums text-muted-foreground">
        {index + 1}
      </span>

      {/* Actions stay hidden until hover or keyboard focus to keep the strip calm. The
          background pill keeps the icons legible over dark or busy frame art. */}
      <div className="pointer-events-none absolute top-0.5 right-0.5 flex gap-0.5 rounded-md bg-background/85 p-0.5 opacity-0 shadow-sm ring-1 ring-border/60 backdrop-blur-sm transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
        <TooltipButton
          label="Duplicate frame"
          shortcut={shortcutHint("frame.duplicate")}
          side="top"
          size="icon-xs"
          variant="ghost"
          onClick={onDuplicate}
        >
          <Copy />
        </TooltipButton>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Delete frame"
          disabled={!canDelete}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

/** The card's own visual, for the board's drag overlay — DragBoard supplies the lift and ring. */
export function FrameDragPreview({ frameId, index }: { frameId: string; index: number }) {
  return (
    <div className="relative rounded-lg bg-card p-1">
      <FrameThumbnail frameId={frameId} />
      <span className="absolute bottom-1 left-1.5 text-[10px] tabular-nums text-muted-foreground">
        {index + 1}
      </span>
    </div>
  );
}
