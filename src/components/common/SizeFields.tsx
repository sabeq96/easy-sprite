import { Link2, Unlink2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from "@/constants/canvas";
import { clamp } from "@/lib/math";
import type { CanvasSize } from "@/lib/validation";

export interface SizeFieldsProps {
  size: CanvasSize;
  linked: boolean;
  onLinkedChange: (linked: boolean) => void;
  onChange: (size: CanvasSize) => void;
}

export function SizeFields({ size, linked, onLinkedChange, onChange }: SizeFieldsProps) {
  const set = (axis: keyof CanvasSize, raw: string) => {
    const value = clamp(Number(raw) || MIN_CANVAS_SIZE, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE);
    onChange(linked ? { width: value, height: value } : { ...size, [axis]: value });
  };

  return (
    <div className="flex items-end gap-2">
      <Field className="flex-1">
        <FieldLabel htmlFor="canvas-width">Width</FieldLabel>
        <Input
          id="canvas-width"
          type="number"
          min={MIN_CANVAS_SIZE}
          max={MAX_CANVAS_SIZE}
          value={size.width}
          onChange={(event) => set("width", event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
        />
      </Field>

      <Button
        size="icon"
        variant={linked ? "secondary" : "ghost"}
        aria-label={linked ? "Unlink width and height" : "Link width and height"}
        aria-pressed={linked}
        onClick={() => onLinkedChange(!linked)}
      >
        {linked ? <Link2 /> : <Unlink2 />}
      </Button>

      <Field className="flex-1">
        <FieldLabel htmlFor="canvas-height">Height</FieldLabel>
        <Input
          id="canvas-height"
          type="number"
          min={MIN_CANVAS_SIZE}
          max={MAX_CANVAS_SIZE}
          value={size.height}
          onChange={(event) => set("height", event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
        />
      </Field>
    </div>
  );
}
