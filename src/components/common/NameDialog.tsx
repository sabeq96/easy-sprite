import type { ReactNode } from "react";
import { FormDialog } from "@/components/common/FormDialog";
import { NameForm, type NameFormProps } from "@/components/common/NameForm";

export type NameDialogProps = Omit<NameFormProps, "onDone" | "children"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
};

/** Create or rename anything that has a name (and maybe tags): sprites, spritesheets, palettes. */
export function NameDialog({ open, onOpenChange, title, description, ...form }: NameDialogProps) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {(close) => <NameForm {...form} onDone={close} />}
    </FormDialog>
  );
}
