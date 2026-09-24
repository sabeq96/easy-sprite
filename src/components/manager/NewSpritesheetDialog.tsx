import { useState } from "react";
import { useNavigate } from "react-router";
import { TagsField } from "@/components/common/TagsField";
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
import { ROUTES } from "@/constants/routes";
import { createSpritesheet } from "@/db/repositories/spritesheets";
import { parseTags } from "@/lib/tags";

export interface NewSpritesheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewSpritesheetDialog({ open, onOpenChange }: NewSpritesheetDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");

  const create = async () => {
    const spritesheet = await createSpritesheet({ name, tags: parseTags(tags) });
    onOpenChange(false);
    setName("");
    setTags("");
    // Straight into the composer — creating a spritesheet is never the end goal.
    navigate(ROUTES.spritesheet(spritesheet.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New spritesheet</DialogTitle>
          <DialogDescription>
            Name it, then drag sprites onto it to compose the sheet.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="new-spritesheet-name">Name</FieldLabel>
          <Input
            id="new-spritesheet-name"
            autoFocus
            placeholder="Untitled"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") void create();
            }}
          />
        </Field>

        <TagsField
          value={tags}
          onChange={setTags}
          placeholder="ui, tiles"
          onSubmit={() => void create()}
        />

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button onClick={create}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
