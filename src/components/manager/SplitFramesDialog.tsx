import { useState } from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { CANVAS_SIZE_PRESETS, MIN_CANVAS_SIZE } from "@/constants/canvas";
import { splitSpriteIntoFrames } from "@/db/repositories/sprites";
import type { SpriteRecord } from "@/db/schema";
import { openDocument } from "@/services/documentService";
import { saveThumbnail } from "@/services/thumbnails";
import { clamp } from "@/lib/math";
import { computeSplitGrid, isValidSplitFrameSize, type CanvasSize } from "@/lib/validation";

export interface SplitFramesDialogProps {
  sprite: SpriteRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A tile size that evenly divides both dimensions, for a sane starting guess. */
function guessFrameSize(sprite: SpriteRecord): CanvasSize {
  const fit = [...CANVAS_SIZE_PRESETS]
    .reverse()
    .find(
      (preset) =>
        preset <= sprite.width &&
        preset <= sprite.height &&
        sprite.width % preset === 0 &&
        sprite.height % preset === 0,
    );
  return fit ? { width: fit, height: fit } : { width: sprite.width, height: sprite.height };
}

export function SplitFramesDialog({ sprite, open, onOpenChange }: SplitFramesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Split "{sprite.name}" into frames</DialogTitle>
          <DialogDescription>
            Cuts the canvas into a grid of same-sized frames, left to right then top to bottom.
            This replaces the current frames and can't be undone.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the draft initialises from props with no effect. */}
        {open && <SplitFramesForm sprite={sprite} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function SplitFramesForm({
  sprite,
  onDone,
}: {
  sprite: SpriteRecord;
  onDone: () => void;
}) {
  const [frameSize, setFrameSize] = useState<CanvasSize>(() => guessFrameSize(sprite));
  const [isSplitting, setSplitting] = useState(false);

  const spriteSize = { width: sprite.width, height: sprite.height };
  const valid = isValidSplitFrameSize(spriteSize, frameSize);
  const grid = valid ? computeSplitGrid(spriteSize, frameSize) : null;

  const set = (axis: keyof CanvasSize, raw: string) => {
    const max = axis === "width" ? sprite.width : sprite.height;
    const value = clamp(Number(raw) || MIN_CANVAS_SIZE, MIN_CANVAS_SIZE, max);
    setFrameSize({ ...frameSize, [axis]: value });
  };

  const split = async () => {
    if (!valid || !grid || grid.frameCount < 1) return;
    setSplitting(true);
    try {
      const updated = await splitSpriteIntoFrames(sprite.id, frameSize.width, frameSize.height);
      const doc = await openDocument(updated.id);
      await saveThumbnail(doc);
      toast.success(`Split into ${grid.frameCount} frames`);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Split failed.");
    } finally {
      setSplitting(false);
    }
  };

  return (
    <>
      <div className="flex items-end gap-2">
        <Field className="flex-1">
          <FieldLabel htmlFor="split-frame-width">Frame width</FieldLabel>
          <Input
            id="split-frame-width"
            type="number"
            min={MIN_CANVAS_SIZE}
            max={sprite.width}
            value={frameSize.width}
            onChange={(event) => set("width", event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
        </Field>
        <Field className="flex-1">
          <FieldLabel htmlFor="split-frame-height">Frame height</FieldLabel>
          <Input
            id="split-frame-height"
            type="number"
            min={MIN_CANVAS_SIZE}
            max={sprite.height}
            value={frameSize.height}
            onChange={(event) => set("height", event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
        </Field>
      </div>

      <p className="text-xs text-muted-foreground">
        Sprite is {sprite.width}×{sprite.height}.{" "}
        {grid && grid.frameCount >= 1 ? (
          <>
            {grid.columns}×{grid.rows} grid → {grid.frameCount}{" "}
            {grid.frameCount === 1 ? "frame" : "frames"}
            {(grid.remainderX > 0 || grid.remainderY > 0) &&
              ` (${grid.remainderX}px right / ${grid.remainderY}px bottom left over)`}
          </>
        ) : (
          "Frame size must fit inside the sprite."
        )}
      </p>

      <DialogFooter>
        <DialogClose render={<Button variant="ghost">Cancel</Button>} />
        <Button onClick={split} disabled={!valid || !grid || grid.frameCount < 1 || isSplitting}>
          Split
        </Button>
      </DialogFooter>
    </>
  );
}
