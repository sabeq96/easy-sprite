import { useState } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { TileCountFields, type TileCount } from "@/components/common/TileCountFields";
import { TileSizePicker } from "@/components/common/TileSizePicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import type { AnchorX, AnchorY } from "@/editor/buffer";
import { resizeCanvasCommand, resizeWillCrop } from "@/editor/commands/canvas";
import { useCommandDispatch } from "@/hooks/useCommandDispatch";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { DEFAULT_TILE_SIZE } from "@/constants/canvas";
import { inferTileSize, tileCountFor } from "@/lib/tiles";
import { cn } from "@/lib/utils";

const ANCHORS_X: AnchorX[] = ["left", "center", "right"];
const ANCHORS_Y: AnchorY[] = ["top", "center", "bottom"];

export interface ResizeCanvasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResizeCanvasDialog({ open, onOpenChange }: ResizeCanvasDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted only while open, so the draft size initialises from the document. */}
        {open && <ResizeForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ResizeForm({ onDone }: { onDone: () => void }) {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);
  const dispatch = useCommandDispatch();

  // Sprites that never recorded a tile get the one that fits them, or the default.
  const initialTile =
    snapshot.tileSize ?? inferTileSize(snapshot.width, snapshot.height) ?? DEFAULT_TILE_SIZE;
  const [tile, setTile] = useState(initialTile);
  const [count, setCount] = useState<TileCount>(() => countFor(initialTile));
  const [anchor, setAnchor] = useState<{ x: AnchorX; y: AnchorY }>({
    x: "center",
    y: "center",
  });

  function countFor(nextTile: number): TileCount {
    return {
      columns: tileCountFor(snapshot.width, nextTile),
      rows: tileCountFor(snapshot.height, nextTile),
    };
  }

  // A new tile keeps the canvas as close to its current size as it can, rather than the count.
  const changeTile = (nextTile: number) => {
    setTile(nextTile);
    setCount(countFor(nextTile));
  };

  const width = count.columns * tile;
  const height = count.rows * tile;
  const willCrop = resizeWillCrop(doc, width, height);
  // Against the tile the dialog opened with, so a sprite that never recorded one isn't "changed"
  // just by opening the dialog.
  const unchanged = width === snapshot.width && height === snapshot.height && tile === initialTile;

  const apply = () => {
    dispatch(() =>
      resizeCanvasCommand(doc, width, height, { anchorX: anchor.x, anchorY: anchor.y }, tile),
    );
    onDone();
  };

  return (
    <>
        <DialogHeader>
          <DialogTitle>Resize canvas</DialogTitle>
          <DialogDescription>
            Currently {snapshot.width}×{snapshot.height}. This crops or pads the canvas; it does not scale
            the artwork.
          </DialogDescription>
        </DialogHeader>

        <TileSizePicker value={tile} onChange={changeTile} />
        <TileCountFields tile={tile} value={count} onChange={setCount} />

        <Field>
          <FieldLabel>Anchor</FieldLabel>
          <div className="grid w-fit grid-cols-3 gap-1">
            {ANCHORS_Y.map((y) =>
              ANCHORS_X.map((x) => {
                const isActive = anchor.x === x && anchor.y === y;
                return (
                  <button
                    key={`${x}-${y}`}
                    type="button"
                    aria-label={`Anchor ${y} ${x}`}
                    aria-pressed={isActive}
                    onClick={() => setAnchor({ x, y })}
                    className={cn(
                      "size-7 rounded-sm ring-1 ring-foreground/10 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      isActive ? "bg-primary ring-primary" : "hover:bg-muted",
                    )}
                  />
                );
              }),
            )}
          </div>
        </Field>

        {willCrop && (
          <p className="text-xs text-destructive">
            Pixels outside the new canvas will be deleted. This can be undone.
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button
            onClick={apply}
            disabled={unchanged}
          >
            Resize
          </Button>
        </DialogFooter>
    </>
  );
}
