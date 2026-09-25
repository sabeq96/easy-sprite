import { useState } from "react";
import { useNavigate } from "react-router";
import { FormDialog } from "@/components/common/FormDialog";
import { NameForm } from "@/components/common/NameForm";
import { SizeFields } from "@/components/common/SizeFields";
import { Button } from "@/components/ui/button";
import { CANVAS_SIZE_PRESETS, DEFAULT_CANVAS_SIZE } from "@/constants/canvas";
import { DEFAULT_ITEM_NAME } from "@/constants/names";
import { ROUTES } from "@/constants/routes";
import { useSpriteActions } from "@/hooks/useSpriteActions";
import { isSpriteOversized, isValidCanvasSize, type CanvasSize } from "@/lib/validation";

export interface NewSpriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewSpriteDialog({ open, onOpenChange }: NewSpriteDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New sprite"
      description="Pick a canvas size. You can resize it later."
    >
      {(close) => <NewSpriteForm onDone={close} />}
    </FormDialog>
  );
}

function NewSpriteForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const sprites = useSpriteActions();
  const [size, setSize] = useState<CanvasSize>({
    width: DEFAULT_CANVAS_SIZE,
    height: DEFAULT_CANVAS_SIZE,
  });
  const [linked, setLinked] = useState(true);

  return (
    <NameForm
      submitLabel="Create"
      namePlaceholder={DEFAULT_ITEM_NAME}
      withTags
      tagsPlaceholder="hero, walk, idle"
      canSubmit={isValidCanvasSize(size)}
      onSubmit={async ({ name, tags }) => {
        const sprite = await sprites.create({ name, tags, ...size });
        // Straight into the editor — creating a sprite is never the end goal.
        if (sprite) navigate(ROUTES.sprite(sprite.id));
      }}
      onDone={onDone}
    >
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

      <SizeFields size={size} linked={linked} onLinkedChange={setLinked} onChange={setSize} />

      {isSpriteOversized(size) && (
        <p className="text-xs text-destructive">
          That canvas is very large. Expect slow drawing and heavy storage use.
        </p>
      )}
    </NameForm>
  );
}
