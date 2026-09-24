import { useNavigate } from "react-router";
import { NameDialog } from "@/components/common/NameDialog";
import { DEFAULT_ITEM_NAME } from "@/constants/names";
import { ROUTES } from "@/constants/routes";
import { useSpritesheetActions } from "@/hooks/useSpritesheetActions";

export interface NewSpritesheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewSpritesheetDialog({ open, onOpenChange }: NewSpritesheetDialogProps) {
  const navigate = useNavigate();
  const spritesheets = useSpritesheetActions();

  return (
    <NameDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New spritesheet"
      description="Name it, then drag sprites onto it to compose the sheet."
      submitLabel="Create"
      namePlaceholder={DEFAULT_ITEM_NAME}
      withTags
      tagsPlaceholder="ui, tiles"
      onSubmit={async ({ name, tags }) => {
        const spritesheet = await spritesheets.create({ name, tags });
        // Straight into the composer — creating a spritesheet is never the end goal.
        navigate(ROUTES.spritesheet(spritesheet.id));
      }}
    />
  );
}
