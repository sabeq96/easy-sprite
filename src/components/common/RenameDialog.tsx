import { useId, useState } from "react";
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

export interface RenameDialogProps {
  title: string;
  name: string;
  tags: string[];
  /** Example tags for the placeholder, e.g. "hero, walk, idle". */
  tagsPlaceholder?: string;
  onSave: (values: { name: string; tags: string[] }) => void | Promise<unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Renames any library item and edits its tags — sprites and spritesheets share both fields. */
export function RenameDialog({ title, open, onOpenChange, ...form }: RenameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* Mounted only while open, so the draft initialises from props with no effect. */}
        {open && <RenameForm {...form} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

type RenameFormProps = Omit<RenameDialogProps, "title" | "open" | "onOpenChange"> & {
  onDone: () => void;
};

function RenameForm({ name, tags, tagsPlaceholder, onSave, onDone }: RenameFormProps) {
  const fieldId = useId();
  const [nameDraft, setNameDraft] = useState(name);
  const [tagsDraft, setTagsDraft] = useState(tags.join(", "));

  const save = async () => {
    await onSave({
      name: nameDraft.trim() || name,
      tags: tagsDraft
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    });
    onDone();
  };

  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${fieldId}-name`}>Name</FieldLabel>
        <Input
          id={`${fieldId}-name`}
          autoFocus
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") void save();
          }}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={`${fieldId}-tags`}>Tags</FieldLabel>
        <Input
          id={`${fieldId}-tags`}
          placeholder={tagsPlaceholder}
          value={tagsDraft}
          onChange={(event) => setTagsDraft(event.target.value)}
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
