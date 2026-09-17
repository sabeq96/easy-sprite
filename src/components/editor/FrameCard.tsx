import { Copy, Trash2 } from "lucide-react";
import { TooltipButton } from "@/components/common/TooltipButton";
import { FrameThumbnail } from "@/components/editor/FrameThumbnail";
import { Button } from "@/components/ui/button";
import { shortcutHint } from "@/constants/shortcuts";
import { cn } from "@/lib/utils";

export interface FrameCardProps {
  frameId: string;
  index: number;
  isActive: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}

export function FrameCard({
  frameId,
  index,
  isActive,
  canDelete,
  onSelect,
  onDuplicate,
  onDelete,
  onDragStart,
  onDrop,
}: FrameCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={cn(
        "group relative rounded-lg p-1 transition-colors",
        isActive ? "bg-primary/10 shadow-sm" : "hover:bg-muted/50",
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

      {/* Actions stay hidden until hover or keyboard focus to keep the strip calm. */}
      <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
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
    </div>
  );
}
