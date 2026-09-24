import { Copy, Download, Grid3x3, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { duplicateSprite, removeSprite } from "@/db/repositories/sprites";
import type { SpriteRecord } from "@/db/schema";

export interface SpriteCardMenuProps {
  sprite: SpriteRecord;
  onRename: () => void;
  onExport: () => void;
  onSplit: () => void;
}

export function SpriteCardMenu({
  sprite,
  onRename,
  onExport,
  onSplit,
}: SpriteCardMenuProps) {
  const duplicate = async () => {
    const copy = await duplicateSprite(sprite.id);
    toast.success(`Duplicated as "${copy.name}"`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Actions for ${sprite.name}`}
          >
            <MoreVertical />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem onClick={onRename}>
          <Pencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={duplicate}>
          <Copy />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExport}>
          <Download />
          Export PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSplit}>
          <Grid3x3 />
          Split into frames
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* The one destructive action in the app, and there is no trash — always confirm. */}
        <ConfirmDialog
          title={`Delete "${sprite.name}"?`}
          description="This permanently deletes the sprite and all its frames. Export a backup first if you might want it back."
          confirmLabel="Delete"
          destructive
          nativeButton={false}
          onConfirm={() => void removeSprite(sprite.id)}
        >
          <DropdownMenuItem variant="destructive" closeOnClick={false}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </ConfirmDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
