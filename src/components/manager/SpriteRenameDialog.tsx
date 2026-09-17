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
import { updateSprite } from "@/db/repositories/sprites";
import type { SpriteRecord } from "@/db/schema";

export interface SpriteRenameDialogProps {
  sprite: SpriteRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpriteRenameDialog({ sprite, open, onOpenChange }: SpriteRenameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename sprite</DialogTitle>
        </DialogHeader>
        {/* Mounted only while open, so the draft initialises from props with no effect. */}
        {open && <RenameForm sprite={sprite} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({ sprite, onDone }: { sprite: SpriteRecord; onDone: () => void }) {
  const [name, setName] = useState(sprite.name);
  const [tags, setTags] = useState(sprite.tags.join(", "));

  const save = async () => {
    await updateSprite(sprite.id, {
      name: name.trim() || sprite.name,
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
        <FieldLabel htmlFor="sprite-name">Name</FieldLabel>
        <Input
          id="sprite-name"
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
        <FieldLabel htmlFor="sprite-tags">Tags</FieldLabel>
        <Input
          id="sprite-tags"
          placeholder="hero, walk, idle"
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
