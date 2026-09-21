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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup } from "@/components/ui/toggle-group";
import {
  DEFAULT_EXPORT_OPTIONS,
  EXPORT_SCALES,
  SPRITESHEET_LAYOUTS,
  type SpritesheetLayout,
} from "@/constants/export";
import type { SpriteDocument } from "@/editor/document";
import { downloadBlob, downloadJson, toFilenameSlug } from "@/export/download";
import { exportSpritesheet, layoutFor, type SpritesheetOptions } from "@/export/spritesheet";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";

const LAYOUT_LABELS: Record<SpritesheetLayout, string> = {
  horizontal: "Horizontal strip",
  vertical: "Vertical strip",
  grid: "Grid",
};

export interface ExportDialogProps {
  doc: SpriteDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Flushes pending autosave so the sheet always matches what is on screen. */
  onBeforeExport?: () => Promise<void>;
}

interface DialogOptions extends SpritesheetOptions {
  includeMetadata: boolean;
}

export function ExportDialog({ doc, open, onOpenChange, onBeforeExport }: ExportDialogProps) {
  const snapshot = useDocumentSnapshot(doc);
  const [options, setOptions] = useState<DialogOptions>(() => ({ ...DEFAULT_EXPORT_OPTIONS }));
  const [isExporting, setExporting] = useState(false);

  const layout = layoutFor(doc, options);
  const patch = (next: Partial<DialogOptions>) => setOptions((current) => ({ ...current, ...next }));

  const run = async () => {
    setExporting(true);
    try {
      await onBeforeExport?.();
      const { blob, metadata } = await exportSpritesheet(doc, options);
      const slug = toFilenameSlug(doc.name);

      downloadBlob(blob, `${slug}-sheet.png`);
      if (options.includeMetadata) downloadJson(metadata, `${slug}-sheet.json`);

      toast.success(
        `Exported ${doc.frames.length} frames · ${layout.width}×${layout.height}px`,
      );
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
            {snapshot.frames.length} {snapshot.frames.length === 1 ? "frame" : "frames"} ·{" "}
            <span className="tabular-nums">
              {layout.width}×{layout.height}px
            </span>{" "}
            output
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="export-layout">Layout</FieldLabel>
          <Select
            value={options.layout}
            onValueChange={(value) => patch({ layout: value as SpritesheetLayout })}
          >
            <SelectTrigger id="export-layout">
              <SelectValue>
                {(value: SpritesheetLayout) => LAYOUT_LABELS[value] ?? "Layout"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SPRITESHEET_LAYOUTS.map((value) => (
                <SelectItem key={value} value={value}>
                  {LAYOUT_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {options.layout === "grid" && (
          <Field>
            <FieldLabel htmlFor="export-columns">Columns</FieldLabel>
            <Input
              id="export-columns"
              type="number"
              min={1}
              max={snapshot.frames.length}
              value={options.columns ?? 4}
              onChange={(event) => patch({ columns: Math.max(1, Number(event.target.value)) })}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </Field>
        )}

        <Field>
          <FieldLabel>Scale</FieldLabel>
          <ToggleGroup
            value={[String(options.scale)]}
            onValueChange={([value]) => value && patch({ scale: Number(value) })}
            aria-label="Export scale"
          >
            {EXPORT_SCALES.map((scale) => (
              <Toggle key={scale} value={String(scale)} size="sm">
                {scale}×
              </Toggle>
            ))}
          </ToggleGroup>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field>
            <FieldLabel htmlFor="export-padding">Padding</FieldLabel>
            <Input
              id="export-padding"
              type="number"
              min={0}
              max={32}
              value={options.padding ?? 0}
              onChange={(event) => patch({ padding: Math.max(0, Number(event.target.value)) })}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="export-margin">Margin</FieldLabel>
            <Input
              id="export-margin"
              type="number"
              min={0}
              max={32}
              value={options.margin ?? 0}
              onChange={(event) => patch({ margin: Math.max(0, Number(event.target.value)) })}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </Field>
        </div>

        <Label weight="normal" className="justify-between">
          Include hidden layers
          <Switch
            checked={options.includeHidden ?? false}
            onCheckedChange={(checked) => patch({ includeHidden: checked })}
          />
        </Label>

        <Label weight="normal" className="justify-between">
          Also export frame data (.json)
          <Switch
            checked={options.includeMetadata}
            onCheckedChange={(checked) => patch({ includeMetadata: checked })}
          />
        </Label>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button onClick={run} disabled={isExporting}>
            {isExporting ? "Exporting…" : "Export PNG"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
