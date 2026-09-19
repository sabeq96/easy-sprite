import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router";
import { LibraryCard } from "@/components/common/LibraryCard";
import { RenameDialog } from "@/components/common/RenameDialog";
import { SpritesheetCardMenu } from "@/components/manager/SpritesheetCardMenu";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/constants/routes";
import { updateSpritesheet } from "@/db/repositories/spritesheets";
import type { SpritesheetRecord } from "@/db/schema";

export interface SpritesheetCardProps {
  spritesheet: SpritesheetRecord;
}

export function SpritesheetCard({ spritesheet }: SpritesheetCardProps) {
  const navigate = useNavigate();
  const [isRenaming, setRenaming] = useState(false);

  const count = spritesheet.blocks.length;

  return (
    <LibraryCard
      name={spritesheet.name}
      meta={`${count} ${count === 1 ? "sprite" : "sprites"}`}
      thumbnail={spritesheet.thumbnail}
      badge={
        <Badge className="absolute top-2 left-2" variant="secondary">
          <LayoutGrid />
          Sheet
        </Badge>
      }
      onOpen={() => navigate(ROUTES.spritesheet(spritesheet.id))}
      menu={
        <SpritesheetCardMenu
          spritesheet={spritesheet}
          onRename={() => setRenaming(true)}
        />
      }
    >
      <RenameDialog
        title="Rename spritesheet"
        name={spritesheet.name}
        tags={spritesheet.tags}
        tagsPlaceholder="ui, tiles"
        onSave={(values) => updateSpritesheet(spritesheet.id, values)}
        open={isRenaming}
        onOpenChange={setRenaming}
      />
    </LibraryCard>
  );
}
