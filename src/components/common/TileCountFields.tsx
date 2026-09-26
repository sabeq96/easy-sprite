import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { clamp } from "@/lib/math";
import { maxTileCount } from "@/lib/tiles";

export interface TileCount {
  columns: number;
  rows: number;
}

export interface TileCountFieldsProps {
  tile: number;
  value: TileCount;
  onChange: (value: TileCount) => void;
}

/** A canvas size as columns × rows of `tile`, capped so the canvas stays within the max size. */
export function TileCountFields({ tile, value, onChange }: TileCountFieldsProps) {
  const max = maxTileCount(tile);
  const set = (axis: keyof TileCount, raw: string) =>
    onChange({ ...value, [axis]: clamp(Math.floor(Number(raw)) || 1, 1, max) });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <Field className="flex-1">
          <FieldLabel htmlFor="tile-columns">Columns</FieldLabel>
          <Input
            id="tile-columns"
            type="number"
            min={1}
            max={max}
            value={value.columns}
            onChange={(event) => set("columns", event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
        </Field>
        <span className="pb-2 text-sm text-muted-foreground">×</span>
        <Field className="flex-1">
          <FieldLabel htmlFor="tile-rows">Rows</FieldLabel>
          <Input
            id="tile-rows"
            type="number"
            min={1}
            max={max}
            value={value.rows}
            onChange={(event) => set("rows", event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
        </Field>
      </div>
      <FieldDescription>
        <span className="tabular-nums">
          {value.columns * tile}×{value.rows * tile} px
        </span>
      </FieldDescription>
    </div>
  );
}
