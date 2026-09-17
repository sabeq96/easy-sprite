import { useState } from "react";
import { Images, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { NewSpriteDialog } from "@/components/manager/NewSpriteDialog";
import { SpriteCard } from "@/components/manager/SpriteCard";
import { SpriteLibraryToolbar } from "@/components/manager/SpriteLibraryToolbar";
import { DEFAULT_EXPORT_OPTIONS } from "@/constants/export";
import type { SpriteRecord } from "@/db/schema";
import { downloadBlob, toFilenameSlug } from "@/export/download";
import { exportSpritesheet } from "@/export/spritesheet";
import { openDocument } from "@/services/documentService";
import { useSpriteLibrary } from "@/hooks/useSpriteLibrary";

export function SpriteManagerPage() {
  const library = useSpriteLibrary();
  const [isCreating, setCreating] = useState(false);

  // Quick export straight from the gallery, at defaults; the editor dialog has the options.
  const exportSprite = async (sprite: SpriteRecord) => {
    try {
      const doc = await openDocument(sprite.id);
      const { blob } = await exportSpritesheet(doc, DEFAULT_EXPORT_OPTIONS);
      downloadBlob(blob, `${toFilenameSlug(sprite.name)}-sheet.png`);
      toast.success(`Exported ${doc.frames.length} frames`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <SpriteLibraryToolbar library={library} onCreate={() => setCreating(true)} />

      {library.isLoading ? (
        <SpriteGridSkeleton />
      ) : library.sprites.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Images />
            </EmptyMedia>
            <EmptyTitle>
              {library.search || library.tag ? "No sprites match" : "No sprites yet"}
            </EmptyTitle>
            <EmptyDescription>
              {library.search || library.tag
                ? "Try a different search or clear the tag filter."
                : "Create one to start drawing."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New sprite
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
          {library.sprites.map((sprite) => (
            <li key={sprite.id}>
              <SpriteCard sprite={sprite} onExport={exportSprite} />
            </li>
          ))}
        </ul>
      )}

      <NewSpriteDialog open={isCreating} onOpenChange={setCreating} />
    </div>
  );
}

function SpriteGridSkeleton() {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
      {Array.from({ length: 8 }, (_, index) => (
        <li key={index}>
          <Skeleton className="h-40 rounded-xl" />
        </li>
      ))}
    </ul>
  );
}
