import { useState } from "react";
import { useNavigate } from "react-router";
import { LibraryCard } from "@/components/common/LibraryCard";
import { RenameDialog } from "@/components/common/RenameDialog";
import { SpriteCardMenu } from "@/components/manager/SpriteCardMenu";
import { ROUTES } from "@/constants/routes";
import { updateSprite } from "@/db/repositories/sprites";
import type { SpriteRecord } from "@/db/schema";

export interface SpriteCardProps {
  sprite: SpriteRecord;
  onExport: (sprite: SpriteRecord) => void;
}

export function SpriteCard({ sprite, onExport }: SpriteCardProps) {
  const navigate = useNavigate();
  const [isRenaming, setRenaming] = useState(false);

  const frameLabel = `${sprite.frames.length} ${sprite.frames.length === 1 ? "frame" : "frames"}`;

  return (
    <LibraryCard
      name={sprite.name}
      meta={`${sprite.width}×${sprite.height} · ${frameLabel}`}
      thumbnail={sprite.thumbnail}
      onOpen={() => navigate(ROUTES.sprite(sprite.id))}
      menu={
        <SpriteCardMenu
          sprite={sprite}
          onRename={() => setRenaming(true)}
          onExport={() => onExport(sprite)}
        />
      }
    >
      <RenameDialog
        title="Rename sprite"
        name={sprite.name}
        tags={sprite.tags}
        tagsPlaceholder="hero, walk, idle"
        onSave={(values) => updateSprite(sprite.id, values)}
        open={isRenaming}
        onOpenChange={setRenaming}
      />
    </LibraryCard>
  );
}
