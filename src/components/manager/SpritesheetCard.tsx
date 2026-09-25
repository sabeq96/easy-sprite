import { useState } from "react";
import { LayoutGrid, Pencil } from "lucide-react";
import { useNavigate } from "react-router";
import { LibraryCard } from "@/components/common/LibraryCard";
import { LibraryItemMenu } from "@/components/common/LibraryItemMenu";
import { NameDialog } from "@/components/common/NameDialog";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants/routes";
import type { SpritesheetRecord } from "@/db/schema";
import { useSpritesheetActions } from "@/hooks/useSpritesheetActions";
import { plural } from "@/lib/format";

export interface SpritesheetCardProps {
  spritesheet: SpritesheetRecord;
}

export function SpritesheetCard({ spritesheet }: SpritesheetCardProps) {
  const navigate = useNavigate();
  const actions = useSpritesheetActions();
  const [isRenaming, setRenaming] = useState(false);

  return (
    <LibraryCard
      name={spritesheet.name}
      meta={plural(spritesheet.blocks.length, "sprite")}
      thumbnail={spritesheet.thumbnail}
      badge={
        <Badge className="absolute top-2 left-2" variant="secondary">
          <LayoutGrid />
          Sheet
        </Badge>
      }
      onOpen={() => navigate(ROUTES.spritesheet(spritesheet.id))}
      menu={
        <LibraryItemMenu
          name={spritesheet.name}
          deleteDescription="This permanently deletes the spritesheet's arrangement. The sprites placed on it are not affected."
          onDelete={() => void actions.remove(spritesheet)}
        >
          <DropdownMenuItem onClick={() => setRenaming(true)}>
            <Pencil />
            Rename
          </DropdownMenuItem>
        </LibraryItemMenu>
      }
    >
      <NameDialog
        open={isRenaming}
        onOpenChange={setRenaming}
        title="Rename spritesheet"
        submitLabel="Save"
        initialName={spritesheet.name}
        withTags
        initialTags={spritesheet.tags}
        tagsPlaceholder="ui, tiles"
        onSubmit={(values) => actions.update(spritesheet.id, values)}
      />
    </LibraryCard>
  );
}
