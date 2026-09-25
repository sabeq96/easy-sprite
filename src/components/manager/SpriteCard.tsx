import { useState } from "react";
import { Copy, Download, Grid3x3, Pencil } from "lucide-react";
import { useNavigate } from "react-router";
import { LibraryCard } from "@/components/common/LibraryCard";
import { LibraryItemMenu } from "@/components/common/LibraryItemMenu";
import { NameDialog } from "@/components/common/NameDialog";
import { SplitFramesDialog } from "@/components/manager/SplitFramesDialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants/routes";
import type { SpriteRecord } from "@/db/schema";
import { useSpriteActions, useSpriteExport } from "@/hooks/useSpriteActions";
import { plural } from "@/lib/format";

export interface SpriteCardProps {
  sprite: SpriteRecord;
}

export function SpriteCard({ sprite }: SpriteCardProps) {
  const navigate = useNavigate();
  const actions = useSpriteActions();
  // Same one-click export as the editor's Export button.
  const exportPng = useSpriteExport();
  const [isRenaming, setRenaming] = useState(false);
  const [isSplitting, setSplitting] = useState(false);

  return (
    <LibraryCard
      name={sprite.name}
      meta={`${sprite.width}×${sprite.height} · ${plural(sprite.frames.length, "frame")}`}
      thumbnail={sprite.thumbnail}
      onOpen={() => navigate(ROUTES.sprite(sprite.id))}
      menu={
        <LibraryItemMenu
          name={sprite.name}
          deleteDescription="This permanently deletes the sprite and all its frames. Export a backup first if you might want it back."
          onDelete={() => void actions.remove(sprite)}
        >
          <DropdownMenuItem onClick={() => setRenaming(true)}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void actions.duplicate(sprite)}>
            <Copy />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void exportPng.run(sprite.id)}>
            <Download />
            Export
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSplitting(true)}>
            <Grid3x3 />
            Split into frames
          </DropdownMenuItem>
        </LibraryItemMenu>
      }
    >
      <NameDialog
        open={isRenaming}
        onOpenChange={setRenaming}
        title="Rename sprite"
        submitLabel="Save"
        initialName={sprite.name}
        withTags
        initialTags={sprite.tags}
        tagsPlaceholder="hero, walk, idle"
        onSubmit={(values) => actions.update(sprite.id, values)}
      />
      <SplitFramesDialog sprite={sprite} open={isSplitting} onOpenChange={setSplitting} />
    </LibraryCard>
  );
}
