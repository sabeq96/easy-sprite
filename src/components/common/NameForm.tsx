import { useId, useState, type ReactNode } from "react";
import { TagsField } from "@/components/common/TagsField";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { parseTags } from "@/lib/tags";

export interface NameFormValues {
  /** Trimmed. Blank falls back to `initialName`, and a blank `initialName` to the repo default. */
  name: string;
  tags: string[];
}

export interface NameFormProps {
  submitLabel: string;
  onSubmit: (values: NameFormValues) => unknown;
  /** Called once `onSubmit` has settled — `FormDialog` passes its `close`. */
  onDone: () => void;
  initialName?: string;
  namePlaceholder?: string;
  /** Blank names disable submit instead of falling back. */
  requireName?: boolean;
  /** Shows the tags field, seeded with `initialTags`. */
  withTags?: boolean;
  initialTags?: string[];
  tagsPlaceholder?: string;
  /** Extra validity from `children`, e.g. a canvas size that must be in range. */
  canSubmit?: boolean;
  /** Extra fields, rendered between the name/tags fields and the footer. */
  children?: ReactNode;
}

/** Name (and optionally tags) with Enter-to-submit and a Cancel/submit footer. */
export function NameForm({
  submitLabel,
  onSubmit,
  onDone,
  initialName = "",
  namePlaceholder,
  requireName = false,
  withTags = false,
  initialTags = [],
  tagsPlaceholder,
  canSubmit = true,
  children,
}: NameFormProps) {
  const nameId = useId();
  const [name, setName] = useState(initialName);
  const [tags, setTags] = useState(initialTags.join(", "));
  const isValid = canSubmit && (!requireName || name.trim() !== "");

  const submit = async () => {
    if (!isValid) return;
    await onSubmit({ name: name.trim() || initialName, tags: parseTags(tags) });
    onDone();
  };

  return (
    <>
      <Field>
        <FieldLabel htmlFor={nameId}>Name</FieldLabel>
        <Input
          id={nameId}
          autoFocus
          placeholder={namePlaceholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            // Keeps editor shortcuts (e.g. B for brush) from firing while typing.
            event.stopPropagation();
            if (event.key === "Enter") void submit();
          }}
        />
      </Field>

      {withTags && (
        <TagsField
          value={tags}
          onChange={setTags}
          placeholder={tagsPlaceholder}
          onSubmit={() => void submit()}
        />
      )}

      {children}

      <DialogFooter>
        <DialogClose render={<Button variant="ghost">Cancel</Button>} />
        <Button onClick={() => void submit()} disabled={!isValid}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
