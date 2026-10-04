import { useState } from "react";
import { TileCountFields } from "@/components/common/TileCountFields";
import { TileSizePicker } from "@/components/common/TileSizePicker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { MAX_FPS, MIN_FPS } from "@/constants/animation";
import {
  GRID_DEFAULT_SIZES,
  ONION_OPACITY_MAX,
  ONION_OPACITY_MIN,
  type Defaults,
} from "@/constants/defaults";
import { usePaletteList } from "@/hooks/usePaletteList";
import { useDefaultsStore } from "@/stores/useDefaultsStore";
import { DefaultRow } from "./DefaultRow";

const GROUPS = {
  newItems: ["tileSize", "spriteColumns", "spriteRows"],
  grid: ["gridEnabled", "gridSize", "checkerSize"],
  animation: ["previewFps", "onionEnabled", "onionDirection", "onionOpacity"],
  palette: ["paletteId"],
} as const satisfies Record<string, readonly (keyof Defaults)[]>;

/** The Select's value for "no default palette", since Base UI's Select has no null item. */
const FIRST_PALETTE = "first";

export function DefaultsSection() {
  const defaults = useDefaultsStore((state) => state.defaults);
  const stored = useDefaultsStore((state) => state.stored);
  const set = useDefaultsStore((state) => state.set);
  const reset = useDefaultsStore((state) => state.reset);
  const palettes = usePaletteList();

  const row = (label: string, keys: readonly (keyof Defaults)[]) => ({
    label,
    changed: keys.some((key) => key in stored),
    onReset: () => reset(keys),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Defaults</CardTitle>
        <CardDescription>
          Used when you create or open a sprite or sheet. Existing sprites never change.
        </CardDescription>
      </CardHeader>

      <CardContent gap="md" className="flex flex-col">
        <DefaultRow {...row("New sprites and sheets", GROUPS.newItems)}>
          <TileSizePicker value={defaults.tileSize} onChange={(tile) => set("tileSize", tile)} />
          <TileCountFields
            tile={defaults.tileSize}
            value={{ columns: defaults.spriteColumns, rows: defaults.spriteRows }}
            onChange={({ columns, rows }) => {
              if (columns !== defaults.spriteColumns) set("spriteColumns", columns);
              if (rows !== defaults.spriteRows) set("spriteRows", rows);
            }}
          />
        </DefaultRow>

        <DefaultRow {...row("Grid and checkerboard", GROUPS.grid)}>
          <Label size="sm" weight="normal" className="justify-between">
            Show grid
            <Switch checked={defaults.gridEnabled} onCheckedChange={(on) => set("gridEnabled", on)} />
          </Label>
          <SizeChoices
            label="Grid size"
            value={defaults.gridSize}
            withTile
            onChange={(size) => set("gridSize", size)}
          />
          <SizeChoices
            label="Checkerboard size"
            value={defaults.checkerSize}
            onChange={(size) => size !== "tile" && set("checkerSize", size)}
          />
        </DefaultRow>

        <DefaultRow {...row("Animation", GROUPS.animation)}>
          <CommitSlider
            label="Preview speed"
            min={MIN_FPS}
            max={MAX_FPS}
            value={defaults.previewFps}
            format={(fps) => `${fps} fps`}
            onCommit={(fps) => set("previewFps", fps)}
          />
          <Label size="sm" weight="normal" className="justify-between">
            Onion skin
            <Switch checked={defaults.onionEnabled} onCheckedChange={(on) => set("onionEnabled", on)} />
          </Label>
          <Label size="sm" weight="normal" className="justify-between">
            Onion skin shows the frame after
            <Switch
              checked={defaults.onionDirection === "after"}
              onCheckedChange={(after) => set("onionDirection", after ? "after" : "before")}
            />
          </Label>
          <CommitSlider
            label="Onion skin opacity"
            min={ONION_OPACITY_MIN * 100}
            max={ONION_OPACITY_MAX * 100}
            value={Math.round(defaults.onionOpacity * 100)}
            format={(percent) => `${percent}%`}
            onCommit={(percent) => set("onionOpacity", percent / 100)}
          />
        </DefaultRow>

        <DefaultRow {...row("Palette", GROUPS.palette)}>
          <Select
            value={defaults.paletteId ?? FIRST_PALETTE}
            onValueChange={(value) =>
              set("paletteId", typeof value === "string" && value !== FIRST_PALETTE ? value : null)
            }
          >
            <SelectTrigger size="sm" aria-label="Default palette">
              {/* Base UI renders the raw value by default; map it back to the palette name. */}
              <SelectValue>
                {(value: string) =>
                  palettes.find((palette) => palette.id === value)?.name ?? "First palette"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FIRST_PALETTE}>First palette</SelectItem>
              {palettes.map((palette) => (
                <SelectItem key={palette.id} value={palette.id}>
                  {palette.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DefaultRow>
      </CardContent>
    </Card>
  );
}

interface SizeChoicesProps {
  label: string;
  value: "tile" | number;
  /** Offers "Tile" first: follow each sprite's or sheet's own tile. */
  withTile?: boolean;
  onChange: (size: "tile" | number) => void;
}

function SizeChoices({ label, value, withTile = false, onChange }: SizeChoicesProps) {
  return (
    <Label size="sm" weight="normal" gap="sm" className="flex-col items-start">
      {label}
      <ToggleGroup
        value={[String(value)]}
        // Picking the active size again would empty the group; keep the current one instead.
        onValueChange={([next]) => next && onChange(next === "tile" ? "tile" : Number(next))}
        aria-label={label}
        className="flex-wrap"
      >
        {withTile && (
          <Toggle value="tile" size="sm">
            Tile
          </Toggle>
        )}
        {GRID_DEFAULT_SIZES.map((size) => (
          <Toggle key={size} value={String(size)} size="sm">
            {size}
          </Toggle>
        ))}
      </ToggleGroup>
    </Label>
  );
}

interface CommitSliderProps {
  label: string;
  min: number;
  max: number;
  value: number;
  format: (value: number) => string;
  onCommit: (value: number) => void;
}

/** Shows the value while dragging but saves only on release, so a drag is one write. */
function CommitSlider({ label, min, max, value, format, onCommit }: CommitSliderProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = dragging ?? value;
  const first = (next: number | readonly number[]) => (Array.isArray(next) ? next[0] : next) as number;

  return (
    <Label size="sm" weight="normal" gap="sm" className="flex-col items-start">
      {label} · {format(shown)}
      <Slider
        min={min}
        max={max}
        value={[shown]}
        aria-label={label}
        onValueChange={(next) => setDragging(first(next))}
        onValueCommitted={(next) => {
          setDragging(null);
          onCommit(first(next));
        }}
      />
    </Label>
  );
}
