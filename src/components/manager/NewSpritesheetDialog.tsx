import { useState } from "react";
import { useNavigate } from "react-router";
import { FormDialog } from "@/components/common/FormDialog";
import { NameForm } from "@/components/common/NameForm";
import { TileSizePicker } from "@/components/common/TileSizePicker";
import { DEFAULT_TILE_SIZE } from "@/constants/canvas";
import { DEFAULT_ITEM_NAME } from "@/constants/names";
import { ROUTES } from "@/constants/routes";
import { useSpritesheetActions } from "@/hooks/useSpritesheetActions";

export interface NewSpritesheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewSpritesheetDialog({ open, onOpenChange }: NewSpritesheetDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New spritesheet"
      description="Name it and pick its tile size, then drag sprites onto it to compose the sheet."
    >
      {(close) => <NewSpritesheetForm onDone={close} />}
    </FormDialog>
  );
}

function NewSpritesheetForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const spritesheets = useSpritesheetActions();
  const [tile, setTile] = useState(DEFAULT_TILE_SIZE);

  return (
    <NameForm
      submitLabel="Create"
      namePlaceholder={DEFAULT_ITEM_NAME}
      withTags
      tagsPlaceholder="ui, tiles"
      onSubmit={async ({ name, tags }) => {
        const spritesheet = await spritesheets.create({ name, tags, tileSize: tile });
        // Straight into the composer — creating a spritesheet is never the end goal.
        if (spritesheet) navigate(ROUTES.spritesheet(spritesheet.id));
      }}
      onDone={onDone}
    >
      <TileSizePicker value={tile} onChange={setTile} />
    </NameForm>
  );
}
