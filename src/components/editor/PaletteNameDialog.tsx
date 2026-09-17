import { useState } from "react";
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

export interface PaletteNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initialName?: string;
  confirmLabel: string;
  onConfirm: (name: string) => void;
}

/**
 * Shared by "New palette" (name-first) and "Rename palette". The caller must remount this on
 * each open (e.g. `key={open}`) so the draft always starts from the current `initialName`.
 */
export function PaletteNameDialog({
  open,
  onOpenChange,
  title,
  description,
  initialName = "",
  confirmLabel,
  onConfirm,
}: PaletteNameDialogProps) {
  const [name, setName] = useState(initialName);

  const confirm = () => {
    if (!name.trim()) return;
    onConfirm(name.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="palette-name">Name</FieldLabel>
          <Input
            id="palette-name"
            autoFocus
            placeholder="New palette"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") confirm();
            }}
          />
        </Field>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button onClick={confirm} disabled={!name.trim()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
