import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { removeSpritesheet } from "@/db/repositories/spritesheets";
import type { SpritesheetRecord } from "@/db/schema";

export interface SpritesheetCardMenuProps {
  spritesheet: SpritesheetRecord;
  onRename: () => void;
}

export function SpritesheetCardMenu({ spritesheet, onRename }: SpritesheetCardMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="icon-xs" variant="ghost" aria-label={`Actions for ${spritesheet.name}`}>
            <MoreVertical />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onRename}>
          <Pencil />
          Rename
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* There is no trash — always confirm before a permanent delete. */}
        <ConfirmDialog
          title={`Delete "${spritesheet.name}"?`}
          description="This permanently deletes the spritesheet's arrangement. The sprites placed on it are not affected."
          confirmLabel="Delete"
          destructive
          nativeButton={false}
          onConfirm={() => void removeSpritesheet(spritesheet.id)}
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
