import { useDraggable } from "@dnd-kit/core";
import { Search } from "lucide-react";
import type { DragData } from "@/components/builder/useBuilderDnd";
import { Panel } from "@/components/common/Panel";
import { Input } from "@/components/ui/input";
import type { SpriteRecord } from "@/db/schema";
import { useBlobUrl } from "@/hooks/useBlobUrl";
import { useSpriteLibrary } from "@/hooks/useSpriteLibrary";
import { cn } from "@/lib/utils";

/** Every sprite in the project, searchable — drag one onto the canvas above to place it. */
export function BuilderPalette() {
  const library = useSpriteLibrary();

  return (
    <Panel className="flex h-32 shrink-0 flex-col gap-2 p-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-7 w-56 pl-7"
          placeholder="Search sprites"
          aria-label="Search sprites"
          value={library.search}
          onChange={(event) => library.setSearch(event.target.value)}
        />
      </div>

      <div className="flex flex-1 items-center gap-2 overflow-x-auto">
        {library.sprites.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sprites match.</p>
        ) : (
          library.sprites.map((sprite) => <PaletteItem key={sprite.id} sprite={sprite} />)
        )}
      </div>
    </Panel>
  );
}

function PaletteItem({ sprite }: { sprite: SpriteRecord }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${sprite.id}`,
    data: {
      type: "palette",
      spriteId: sprite.id,
      name: sprite.name,
      width: sprite.width,
      height: sprite.height,
      frameCount: sprite.frames.length,
    } satisfies DragData,
  });
  const thumbnailUrl = useBlobUrl(sprite.thumbnail);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Drag ${sprite.name} onto the sheet`}
      className={cn(
        "flex h-20 w-20 shrink-0 touch-none flex-col items-center justify-center gap-1 rounded-md bg-checker-a p-1 ring-1 ring-border",
        isDragging && "opacity-40",
      )}
      title={sprite.name}
    >
      {thumbnailUrl ? (
        // draggable={false}: an <img> is natively draggable, and the browser's own drag-and-drop
        // swallows the pointer stream that dnd-kit's sensor needs — grabbing the thumbnail (the
        // obvious place to grab) would otherwise start a ghost-image drag and never place anything.
        <img
          src={thumbnailUrl}
          alt=""
          draggable={false}
          className="pixelated h-10 object-contain"
        />
      ) : (
        <div className="h-10" />
      )}
      <span className="w-full truncate text-center text-[10px] text-muted-foreground">
        {sprite.name}
      </span>
    </div>
  );
}
