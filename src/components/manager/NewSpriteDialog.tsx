import { useState } from "react";
import { useNavigate } from "react-router";
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
import { Input } from "@/components/ui/input";
import { CANVAS_SIZE_PRESETS, DEFAULT_CANVAS_SIZE } from "@/constants/canvas";
import { ROUTES } from "@/constants/routes";
import { createSprite } from "@/db/repositories/sprites";
import { isSpriteOversized, isValidCanvasSize, type CanvasSize } from "@/lib/validation";

export interface NewSpriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewSpriteDialog({ open, onOpenChange }: NewSpriteDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [size, setSize] = useState<CanvasSize>({
    width: DEFAULT_CANVAS_SIZE,
    height: DEFAULT_CANVAS_SIZE,
  });
  const [linked, setLinked] = useState(true);

  const create = async () => {
    const sprite = await createSprite({ name, ...size });
    onOpenChange(false);
    setName("");
    // Straight into the editor — creating a sprite is never the end goal.
    navigate(ROUTES.sprite(sprite.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New sprite</DialogTitle>
          <DialogDescription>Pick a canvas size. You can resize it later.</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="new-sprite-name">Name</FieldLabel>
          <Input
            id="new-sprite-name"
            autoFocus
            placeholder="Untitled"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter" && isValidCanvasSize(size)) void create();
            }}
          />
        </Field>

        <div className="flex flex-wrap gap-1">
          {CANVAS_SIZE_PRESETS.map((preset) => (
            <Button
              key={preset}
              size="xs"
              variant={size.width === preset && size.height === preset ? "secondary" : "outline"}
              onClick={() => setSize({ width: preset, height: preset })}
            >
              {preset}×{preset}
            </Button>
          ))}
        </div>

        <SizeFields
          size={size}
          linked={linked}
          onLinkedChange={setLinked}
          onChange={setSize}
        />

        {isSpriteOversized(size) && (
          <p className="text-xs text-destructive">
            That canvas is very large. Expect slow drawing and heavy storage use.
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button onClick={create} disabled={!isValidCanvasSize(size)}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
