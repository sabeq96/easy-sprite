import { Grid3x3 } from "lucide-react";
import { TooltipButton } from "@/components/common/TooltipButton";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { commandKeys } from "@/commands/keymap";

export interface GridOptionsPopoverProps {
  enabled: boolean;
  onEnabledChange: () => void;
  gridSize: number;
  /** Ascending; `gridSize` must be one of them. */
  gridOptions: number[];
  onGridSizeChange: (size: number) => void;
  checkerSize: number;
  /** Ascending; `checkerSize` must be one of them. */
  checkerOptions: number[];
  onCheckerSizeChange: (size: number) => void;
}

/** Grid toggle plus grid and chessboard size, shared by both editors. Sizes are in sprite px. */
export function GridOptionsPopover({
  enabled,
  onEnabledChange,
  gridSize,
  gridOptions,
  onGridSizeChange,
  checkerSize,
  checkerOptions,
  onCheckerSizeChange,
}: GridOptionsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          // Opens the options; the tooltip still teaches the key that toggles the grid.
          <TooltipButton
            label="Grid options"
            shortcut={commandKeys("view.toggleGrid")}
            variant={enabled ? "secondary" : "ghost"}
            aria-pressed={enabled}
          >
            <Grid3x3 />
          </TooltipButton>
        }
      />
      <PopoverContent gap="md" align="end" className="w-56">
        <Label size="sm" weight="normal" className="justify-between">
          Show grid
          <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        </Label>

        <Separator />

        <SizeSlider
          label="Grid size"
          value={gridSize}
          options={gridOptions}
          onChange={onGridSizeChange}
        />
        <SizeSlider
          label="Chessboard size"
          value={checkerSize}
          options={checkerOptions}
          onChange={onCheckerSizeChange}
        />
      </PopoverContent>
    </Popover>
  );
}

interface SizeSliderProps {
  label: string;
  value: number;
  options: number[];
  onChange: (size: number) => void;
}

/** Slides over the option indices, so every stop is a valid size however uneven the ladder. */
function SizeSlider({ label, value, options, onChange }: SizeSliderProps) {
  return (
    <Label size="sm" weight="normal" gap="sm" className="flex-col">
      {label} · {value}px
      <Slider
        min={0}
        max={options.length - 1}
        step={1}
        value={[options.indexOf(value)]}
        aria-label={label}
        onValueChange={(next) => onChange(options[Array.isArray(next) ? next[0] : next])}
      />
    </Label>
  );
}
