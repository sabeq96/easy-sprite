import { Field, FieldLabel } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { TILE_SIZE_PRESETS } from "@/constants/canvas";

export interface TileSizePickerProps {
  value: number;
  onChange: (tile: number) => void;
}

/** One of TILE_SIZE_PRESETS — the only tile sizes there are. */
export function TileSizePicker({ value, onChange }: TileSizePickerProps) {
  return (
    <Field>
      <FieldLabel>Tile size</FieldLabel>
      <ToggleGroup
        value={[String(value)]}
        // Picking the active tile again would empty the group; keep the current one instead.
        onValueChange={([next]) => next && onChange(Number(next))}
        aria-label="Tile size"
        className="flex-wrap"
      >
        {TILE_SIZE_PRESETS.map((tile) => (
          <Toggle key={tile} value={String(tile)} size="sm">
            {tile}×{tile}
          </Toggle>
        ))}
      </ToggleGroup>
    </Field>
  );
}
