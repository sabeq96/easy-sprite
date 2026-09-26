import { useState } from "react";
import { useNavigate } from "react-router";
import { FormDialog } from "@/components/common/FormDialog";
import { NameForm } from "@/components/common/NameForm";
import { TileCountFields, type TileCount } from "@/components/common/TileCountFields";
import { TileSizePicker } from "@/components/common/TileSizePicker";
import { DEFAULT_TILE_COUNT, DEFAULT_TILE_SIZE } from "@/constants/canvas";
import { DEFAULT_ITEM_NAME } from "@/constants/names";
import { ROUTES } from "@/constants/routes";
import { useSpriteActions } from "@/hooks/useSpriteActions";
import { clamp } from "@/lib/math";
import { maxTileCount } from "@/lib/tiles";
import { isSpriteOversized } from "@/lib/validation";

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
      description="Pick a tile size and how many tiles across and down. You can resize it later."
    >
      {(close) => <NewSpriteForm onDone={close} />}
    </FormDialog>
  );
}

function NewSpriteForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const sprites = useSpriteActions();
  const [tile, setTile] = useState(DEFAULT_TILE_SIZE);
  const [count, setCount] = useState<TileCount>({
    columns: DEFAULT_TILE_COUNT,
    rows: DEFAULT_TILE_COUNT,
  });

  // A bigger tile lowers the cap, so the count is pulled back under it rather than overflowing.
  const changeTile = (nextTile: number) => {
    const max = maxTileCount(nextTile);
    setTile(nextTile);
    setCount({ columns: clamp(count.columns, 1, max), rows: clamp(count.rows, 1, max) });
  };

  const size = { width: count.columns * tile, height: count.rows * tile };

  return (
    <NameForm
      submitLabel="Create"
      namePlaceholder={DEFAULT_ITEM_NAME}
      withTags
      tagsPlaceholder="hero, walk, idle"
      onSubmit={async ({ name, tags }) => {
        const sprite = await sprites.create({ name, tags, tileSize: tile, ...size });
        // Straight into the editor — creating a sprite is never the end goal.
        if (sprite) navigate(ROUTES.sprite(sprite.id));
      }}
      onDone={onDone}
    >
      <TileSizePicker value={tile} onChange={changeTile} />
      <TileCountFields tile={tile} value={count} onChange={setCount} />

      {isSpriteOversized(size) && (
        <p className="text-xs text-destructive">
          That canvas is very large. Expect slow drawing and heavy storage use.
        </p>
      )}
    </NameForm>
  );
}
