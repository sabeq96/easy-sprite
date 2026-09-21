import { useState } from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { EXPORT_SCALES } from "@/constants/export";
import type { SpritesheetBlockRecord } from "@/db/schema";
import type { SpriteDocument } from "@/editor/document";
import { downloadBlob, downloadJson, toFilenameSlug } from "@/export/download";
import { exportBuilderSheet } from "@/export/spritesheetBuilder";

export interface BuilderExportDialogProps {
  name: string;
  blocks: SpritesheetBlockRecord[];
  docs: Map<string, SpriteDocument>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuilderExportDialog({
  name,
  blocks,
  docs,
  open,
  onOpenChange,
}: BuilderExportDialogProps) {
  const [scale, setScale] = useState(1);
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [isExporting, setExporting] = useState(false);

  const run = async () => {
    setExporting(true);
    try {
      const { blob, metadata } = await exportBuilderSheet(blocks, docs, { scale });
      const slug = toFilenameSlug(name);

      downloadBlob(blob, `${slug}.png`);
      if (includeMetadata) downloadJson(metadata, `${slug}.json`);

      toast.success(`Exported ${blocks.length} sprites · ${metadata.width}×${metadata.height}px`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export spritesheet</DialogTitle>
          <DialogDescription>
            {blocks.length} {blocks.length === 1 ? "sprite" : "sprites"} composed onto one sheet.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel>Scale</FieldLabel>
          <ToggleGroup
            value={[String(scale)]}
            onValueChange={([value]) => value && setScale(Number(value))}
            aria-label="Export scale"
          >
            {EXPORT_SCALES.map((value) => (
              <Toggle key={value} value={String(value)} size="sm">
                {value}×
              </Toggle>
            ))}
          </ToggleGroup>
        </Field>

        <Label weight="normal" className="justify-between">
          Also export frame data (.json)
          <Switch checked={includeMetadata} onCheckedChange={setIncludeMetadata} />
        </Label>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button onClick={run} disabled={isExporting || blocks.length === 0}>
            {isExporting ? "Exporting…" : "Export PNG"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
