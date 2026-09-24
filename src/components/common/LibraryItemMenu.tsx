import type { ReactNode } from "react";
import { MoreVertical, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface LibraryItemMenuProps {
  /** The item's name, for the trigger's accessible label and the delete confirmation. */
  name: string;
  /** What deleting takes with it, shown in the confirmation. */
  deleteDescription: string;
  onDelete: () => void;
  /** The kind-specific actions, listed above the delete. */
  children: ReactNode;
}

/** The ⋮ menu on a library card: the item's own actions, then a confirmed delete. */
export function LibraryItemMenu({ name, deleteDescription, onDelete, children }: LibraryItemMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="icon-xs" variant="ghost" aria-label={`Actions for ${name}`}>
            <MoreVertical />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-48">
        {children}

        <DropdownMenuSeparator />

        {/* There is no trash — always confirm before a permanent delete. */}
        <ConfirmDialog
          title={`Delete "${name}"?`}
          description={deleteDescription}
          confirmLabel="Delete"
          destructive
          nativeButton={false}
          onConfirm={onDelete}
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
