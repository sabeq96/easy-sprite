import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clamp } from "@/lib/math";

export interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

export function NumberField({ label, value, min, max, step = 1, onChange }: NumberFieldProps) {
  return (
    <Label className="flex items-center justify-between gap-2 text-xs font-normal">
      {label}
      <Input
        type="number"
        className="h-7 w-20"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isNaN(next)) onChange(clamp(next, min, max));
        }}
        onKeyDown={(event) => event.stopPropagation()}
      />
    </Label>
  );
}
