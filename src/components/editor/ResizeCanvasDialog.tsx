import { useState } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { SizeFields } from "@/components/common/SizeFields";
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
import { cn } from "@/lib/utils";
import { isValidCanvasSize, type CanvasSize } from "@/lib/validation";

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

  const [size, setSize] = useState<CanvasSize>({ width: snapshot.width, height: snapshot.height });
  const [linked, setLinked] = useState(false);
  const [anchor, setAnchor] = useState<{ x: AnchorX; y: AnchorY }>({
    x: "center",
    y: "center",
  });

  const willCrop = resizeWillCrop(doc, size.width, size.height);

  const apply = () => {
    dispatch(() =>
      resizeCanvasCommand(doc, size.width, size.height, { anchorX: anchor.x, anchorY: anchor.y }),
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

        <SizeFields size={size} linked={linked} onLinkedChange={setLinked} onChange={setSize} />

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
                      "size-7 rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      isActive ? "border-ring bg-primary" : "hover:bg-muted",
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
            disabled={
              !isValidCanvasSize(size) ||
              (size.width === snapshot.width && size.height === snapshot.height)
            }
          >
            Resize
          </Button>
        </DialogFooter>
    </>
  );
}
