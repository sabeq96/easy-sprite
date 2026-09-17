import { useState } from "react";
import { useNavigate } from "react-router";
import { SpriteCardMenu } from "@/components/manager/SpriteCardMenu";
import { SpriteRenameDialog } from "@/components/manager/SpriteRenameDialog";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import type { SpriteRecord } from "@/db/schema";
import { useBlobUrl } from "@/hooks/useBlobUrl";

export interface SpriteCardProps {
  sprite: SpriteRecord;
  onExport: (sprite: SpriteRecord) => void;
}

export function SpriteCard({ sprite, onExport }: SpriteCardProps) {
  const navigate = useNavigate();
  const thumbnailUrl = useBlobUrl(sprite.thumbnail);
  const [isRenaming, setRenaming] = useState(false);

  const frameLabel = `${sprite.frames.length} ${sprite.frames.length === 1 ? "frame" : "frames"}`;

  return (
    <Card className="group gap-0 overflow-hidden p-0 transition-colors hover:border-ring">
      <button
        type="button"
        className="block w-full bg-checker-a p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => navigate(ROUTES.sprite(sprite.id))}
        aria-label={`Open ${sprite.name}`}
      >
        {thumbnailUrl ? (
          // Pixel art must never be resampled smoothly, thumbnails included.
          <img
            src={thumbnailUrl}
            alt=""
            className="pixelated mx-auto h-24 object-contain"
          />
        ) : (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            Empty
          </div>
        )}
      </button>

      <div className="flex items-center gap-1 border-t px-2 py-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{sprite.name}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {sprite.width}×{sprite.height} · {frameLabel}
          </p>
        </div>

        <SpriteCardMenu
          sprite={sprite}
          onRename={() => setRenaming(true)}
          onExport={() => onExport(sprite)}
        />
      </div>

      <SpriteRenameDialog sprite={sprite} open={isRenaming} onOpenChange={setRenaming} />
    </Card>
  );
}
