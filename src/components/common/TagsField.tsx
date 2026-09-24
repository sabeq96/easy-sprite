import { useId } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export interface TagsFieldProps {
  /** Raw comma-separated text; parse it with `parseTags` on save. */
  value: string;
  onChange: (value: string) => void;
  /** Example tags, e.g. "hero, walk, idle". */
  placeholder?: string;
  /** Enter submits the surrounding form, as it does in the name field. */
  onSubmit?: () => void;
}

/** The tags input shared by the create and rename dialogs of library items. */
export function TagsField({ value, onChange, placeholder, onSubmit }: TagsFieldProps) {
  const id = useId();

  return (
    <Field>
      <FieldLabel htmlFor={id}>Tags</FieldLabel>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") onSubmit?.();
        }}
      />
    </Field>
  );
}
