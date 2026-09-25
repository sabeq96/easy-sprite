import { Search } from "lucide-react";
import { PALETTE_DROP_ID, type DragData } from "@/hooks/useBuilderDnd";
import { Panel } from "@/components/common/Panel";
import { Input } from "@/components/ui/input";
import type { SpriteRecord } from "@/db/schema";
import { useBlobUrl } from "@/hooks/useBlobUrl";
import { useDragSource, useDropZone } from "@/hooks/useDnd";
import { useLibrary } from "@/hooks/useLibrary";
import { cn } from "@/lib/utils";

export interface BuilderPaletteProps {
  /** Sprites already on the sheet, which drop out of the list until they are removed again. */
  placedSpriteIds: ReadonlySet<string>;
}

/**
 * The sprites still available to place, searchable — drag one onto the canvas above. It is also a
 * drop target: a block dragged back down here leaves the sheet and reappears in the list.
 *
 * A sheet packs each sprite once: placing the same one twice would duplicate its pixels in the
 * exported texture, so a placed sprite leaves the list rather than inviting a second copy.
 */
export function BuilderPalette({ placedSpriteIds }: BuilderPaletteProps) {
  const library = useLibrary("sprite");
  const sprites = library.items.flatMap((item) => (item.kind === "sprite" ? [item.record] : []));
  const available = sprites.filter((sprite) => !placedSpriteIds.has(sprite.id));
  const { ref, dropClass } = useDropZone({ id: PALETTE_DROP_ID, collision: "pointer" });

  return (
    <Panel
      render={<div ref={ref} data-testid="builder-palette" />}
      className={cn("flex h-32 shrink-0 flex-col gap-2 p-2", dropClass)}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-7 w-56"
          iconStart
          placeholder="Search sprites"
          aria-label="Search sprites"
          value={library.search}
          onChange={(event) => library.setSearch(event.target.value)}
        />
      </div>

      <div className="flex flex-1 items-center gap-2 overflow-x-auto">
        {available.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {sprites.length > 0
              ? "Every matching sprite is already on this sheet."
              : "No sprites match."}
          </p>
        ) : (
          available.map((sprite) => <PaletteItem key={sprite.id} sprite={sprite} />)
        )}
      </div>
    </Panel>
  );
}

function PaletteItem({ sprite }: { sprite: SpriteRecord }) {
  const { dragProps, dragClass } = useDragSource(`palette:${sprite.id}`, {
    data: {
      type: "palette",
      spriteId: sprite.id,
      name: sprite.name,
      thumbnail: sprite.thumbnail,
    } satisfies DragData,
  });

  return (
    <div
      {...dragProps}
      aria-label={`Drag ${sprite.name} onto the sheet`}
      className={cn(TILE_CLASS, "shrink-0", dragClass)}
      title={sprite.name}
    >
      <SpriteTile name={sprite.name} thumbnail={sprite.thumbnail} />
    </div>
  );
}

const TILE_CLASS =
  "flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md bg-checker-a p-1 ring-1 ring-border";

/** The tile's contents, shared by the dock item and its drag preview. */
export function SpriteTile({ name, thumbnail }: { name: string; thumbnail: Blob | null }) {
  const thumbnailUrl = useBlobUrl(thumbnail);

  return (
    <>
      {thumbnailUrl ? (
        // draggable={false}: an <img> is natively draggable, and the browser's own drag-and-drop
        // swallows the pointer stream that dnd-kit's sensor needs — grabbing the thumbnail (the
        // obvious place to grab) would otherwise start a ghost-image drag and never place anything.
        <img src={thumbnailUrl} alt="" draggable={false} className="pixelated h-10 object-contain" />
      ) : (
        <div className="h-10" />
      )}
      <span className="w-full truncate text-center text-[10px] text-muted-foreground">{name}</span>
    </>
  );
}

/** The dock tile's own visual, for the board's drag overlay. */
export function SpriteTilePreview({ name, thumbnail }: { name: string; thumbnail: Blob | null }) {
  return (
    <div className={TILE_CLASS}>
      <SpriteTile name={name} thumbnail={thumbnail} />
    </div>
  );
}
