import { Grid3x3, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { TooltipButton } from "@/components/common/TooltipButton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { BUILDER_GRID_CELLS, BUILDER_ZOOM_LEVELS } from "@/constants/builder";
import type { Size } from "@/editor/viewport";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";

/** Zoom −/+ with the level between them, fit, and the grid popover — the composer's ViewControls. */
export function BuilderViewControls({ sheet }: { sheet: Size }) {
  const zoom = useBuilderViewStore((state) => state.zoom);
  const zoomBy = useBuilderViewStore((state) => state.zoomBy);
  const fit = useBuilderViewStore((state) => state.fit);
  const gridEnabled = useBuilderViewStore((state) => state.gridEnabled);
  const toggleGrid = useBuilderViewStore((state) => state.toggleGrid);
  const gridCell = useBuilderViewStore((state) => state.gridCell);
  const setGridCell = useBuilderViewStore((state) => state.setGridCell);

  return (
    <div className="flex items-center gap-0.5">
      <TooltipButton
        label="Zoom out"
        disabled={zoom === BUILDER_ZOOM_LEVELS[0]}
        onClick={() => zoomBy(-1)}
      >
        <ZoomOut />
      </TooltipButton>

      <output aria-label="Zoom level" className="w-8 text-center text-xs tabular-nums text-muted-foreground">
        {zoom}×
      </output>

      <TooltipButton
        label="Zoom in"
        disabled={zoom === BUILDER_ZOOM_LEVELS.at(-1)}
        onClick={() => zoomBy(1)}
      >
        <ZoomIn />
      </TooltipButton>

      <TooltipButton label="Fit to window" onClick={() => fit(sheet)}>
        <Maximize />
      </TooltipButton>

      <Popover>
        <PopoverTrigger
          render={
            <Button
              size="icon-sm"
              variant={gridEnabled ? "secondary" : "ghost"}
              aria-label="Grid options"
              aria-pressed={gridEnabled}
            >
              <Grid3x3 />
            </Button>
          }
        />
        <PopoverContent gap="md" align="end" className="w-56">
          <Label size="sm" weight="normal" className="justify-between">
            Show grid
            <Switch checked={gridEnabled} onCheckedChange={toggleGrid} />
          </Label>

          <Separator />

          <Label size="sm" weight="normal" gap="sm" className="flex-col items-start">
            Grid cell
            <ToggleGroup
              value={[String(gridCell)]}
              onValueChange={([value]) => value && setGridCell(Number(value))}
              aria-label="Grid cell size"
            >
              {BUILDER_GRID_CELLS.map((cell) => (
                <Toggle key={cell} value={String(cell)} size="sm">
                  {cell}px
                </Toggle>
              ))}
            </ToggleGroup>
          </Label>
        </PopoverContent>
      </Popover>
    </div>
  );
}
