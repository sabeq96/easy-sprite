import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateSpritesheet } from "@/db/repositories/spritesheets";
import type { SpritesheetRecord } from "@/db/schema";

export interface SpritesheetRenameDialogProps {
  spritesheet: SpritesheetRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpritesheetRenameDialog({
  spritesheet,
  open,
  onOpenChange,
}: SpritesheetRenameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename spritesheet</DialogTitle>
        </DialogHeader>
        {/* Mounted only while open, so the draft initialises from props with no effect. */}
        {open && <RenameForm spritesheet={spritesheet} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  spritesheet,
  onDone,
}: {
  spritesheet: SpritesheetRecord;
  onDone: () => void;
}) {
  const [name, setName] = useState(spritesheet.name);
  const [tags, setTags] = useState(spritesheet.tags.join(", "));

  const save = async () => {
    await updateSpritesheet(spritesheet.id, {
      name: name.trim() || spritesheet.name,
      tags: tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    });
    onDone();
  };

  return (
    <>
      <Field>
        <FieldLabel htmlFor="spritesheet-name">Name</FieldLabel>
        <Input
          id="spritesheet-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") void save();
          }}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="spritesheet-tags">Tags</FieldLabel>
        <Input
          id="spritesheet-tags"
          placeholder="ui, tiles"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
        />
      </Field>

      <DialogFooter>
        <DialogClose render={<Button variant="ghost">Cancel</Button>} />
        <Button onClick={save}>Save</Button>
      </DialogFooter>
    </>
  );
}
