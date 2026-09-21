import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { useBlobUrl } from "@/hooks/useBlobUrl";

export interface LibraryCardProps {
  name: string;
  /** One line under the name: dimensions, frame or sprite counts. */
  meta: string;
  thumbnail: Blob | null;
  /** Corner marker distinguishing the kind of item, e.g. the spritesheet badge. */
  badge?: ReactNode;
  onOpen: () => void;
  /** The card's action menu, rendered beside the name. */
  menu: ReactNode;
  /** Dialogs the menu opens, kept mounted inside the card. */
  children?: ReactNode;
}

/** A tile in the library gallery — every kind of item the manager lists looks like this. */
export function LibraryCard({
  name,
  meta,
  thumbnail,
  badge,
  onOpen,
  menu,
  children,
}: LibraryCardProps) {
  const thumbnailUrl = useBlobUrl(thumbnail);

  return (
    <Card size="flush" interactive className="group">
      <button
        type="button"
        className="relative block w-full bg-checker-a p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={onOpen}
        aria-label={`Open ${name}`}
      >
        {badge}

        {thumbnailUrl ? (
          // Pixel art must never be resampled smoothly, thumbnails included.
          <img src={thumbnailUrl} alt="" className="pixelated mx-auto h-24 object-contain" />
        ) : (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            Empty
          </div>
        )}
      </button>

      <div className="flex items-center gap-1 border-t px-2 py-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-xs tabular-nums text-muted-foreground">{meta}</p>
        </div>

        {menu}
      </div>

      {children}
    </Card>
  );
}
