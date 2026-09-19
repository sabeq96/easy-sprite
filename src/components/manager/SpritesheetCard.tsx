import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router";
import { SpritesheetCardMenu } from "@/components/manager/SpritesheetCardMenu";
import { SpritesheetRenameDialog } from "@/components/manager/SpritesheetRenameDialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import type { SpritesheetRecord } from "@/db/schema";
import { useBlobUrl } from "@/hooks/useBlobUrl";

export interface SpritesheetCardProps {
  spritesheet: SpritesheetRecord;
}

export function SpritesheetCard({ spritesheet }: SpritesheetCardProps) {
  const navigate = useNavigate();
  const thumbnailUrl = useBlobUrl(spritesheet.thumbnail);
  const [isRenaming, setRenaming] = useState(false);

  const blockLabel = `${spritesheet.blocks.length} ${spritesheet.blocks.length === 1 ? "sprite" : "sprites"}`;

  return (
    <Card className="group gap-0 overflow-hidden p-0 transition-colors hover:border-ring">
      <button
        type="button"
        className="relative block w-full bg-checker-a p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => navigate(ROUTES.spritesheet(spritesheet.id))}
        aria-label={`Open ${spritesheet.name}`}
      >
        <Badge className="absolute top-2 left-2" variant="secondary">
          <LayoutGrid />
          Sheet
        </Badge>

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
          <p className="truncate text-sm font-medium">{spritesheet.name}</p>
          <p className="text-xs tabular-nums text-muted-foreground">{blockLabel}</p>
        </div>

        <SpritesheetCardMenu spritesheet={spritesheet} onRename={() => setRenaming(true)} />
      </div>

      <SpritesheetRenameDialog
        spritesheet={spritesheet}
        open={isRenaming}
        onOpenChange={setRenaming}
      />
    </Card>
  );
}
