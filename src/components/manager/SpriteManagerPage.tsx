import { useState } from "react";
import { Images, Plus } from "lucide-react";
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
import { NewSpritesheetDialog } from "@/components/manager/NewSpritesheetDialog";
import { SpriteCard } from "@/components/manager/SpriteCard";
import { SpriteLibraryToolbar } from "@/components/manager/SpriteLibraryToolbar";
import { SpritesheetCard } from "@/components/manager/SpritesheetCard";
import { useLibrary } from "@/hooks/useLibrary";
import { useSpriteActions } from "@/hooks/useSpriteActions";

export function SpriteManagerPage() {
  const library = useLibrary();
  const [isCreatingSprite, setCreatingSprite] = useState(false);
  const [isCreatingSpritesheet, setCreatingSpritesheet] = useState(false);

  const sprites = useSpriteActions();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <SpriteLibraryToolbar
        library={library}
        onCreateSprite={() => setCreatingSprite(true)}
        onCreateSpritesheet={() => setCreatingSpritesheet(true)}
        onImportFiles={(files) => void sprites.importFiles(files)}
      />

      {library.isLoading ? (
        <SpriteGridSkeleton />
      ) : library.items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Images />
            </EmptyMedia>
            <EmptyTitle>
              {library.search || library.tag ? "Nothing matches" : "No sprites yet"}
            </EmptyTitle>
            <EmptyDescription>
              {library.search || library.tag
                ? "Try a different search or clear the tag filter."
                : "Create one to start drawing."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setCreatingSprite(true)}>
              <Plus />
              New sprite
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
          {library.items.map((item) => (
            <li key={item.record.id}>
              {item.kind === "sprite" ? (
                <SpriteCard sprite={item.record} />
              ) : (
                <SpritesheetCard spritesheet={item.record} />
              )}
            </li>
          ))}
        </ul>
      )}

      <NewSpriteDialog open={isCreatingSprite} onOpenChange={setCreatingSprite} />
      <NewSpritesheetDialog
        open={isCreatingSpritesheet}
        onOpenChange={setCreatingSpritesheet}
      />
    </div>
  );
}

function SpriteGridSkeleton() {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
      {Array.from({ length: 8 }, (_, index) => (
        <li key={index}>
          <Skeleton className="h-40" shape="xl" />
        </li>
      ))}
    </ul>
  );
}
