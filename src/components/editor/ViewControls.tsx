import { Grid3x3, Maximize, ZoomIn, ZoomOut, type LucideIcon } from "lucide-react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { CommandButton } from "@/components/common/CommandButton";
import { TooltipButton } from "@/components/common/TooltipButton";
import { OnionSkinControl } from "@/components/editor/OnionSkinControl";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { MAX_CHECKER_SIZE, MAX_GRID_SIZE } from "@/constants/canvas";
import type { CommandId } from "@/commands/types";
import { commandKeys } from "@/commands/keymap";
import { snapTileSize, tileSizeOptions } from "@/editor/grid";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { useEditorStore } from "@/stores/useEditorStore";

const ZOOM_ACTIONS: { command: CommandId; icon: LucideIcon }[] = [
  { command: "view.zoomOut", icon: ZoomOut },
  { command: "view.zoomIn", icon: ZoomIn },
  { command: "view.fit", icon: Maximize },
];

export function ViewControls() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);
  const gridEnabled = useEditorStore((state) => state.gridEnabled);
  const toggleGrid = useEditorStore((state) => state.toggleGrid);
  const gridSize = useEditorStore((state) => state.gridSize);
  const setGridSize = useEditorStore((state) => state.setGridSize);
  const checkerSize = useEditorStore((state) => state.checkerSize);
  const setCheckerSize = useEditorStore((state) => state.setCheckerSize);

  const sprite = { width: snapshot.width, height: snapshot.height };

  // Only sizes that evenly divide the sprite's width and height, so the grid/checkerboard never
  // clips a partial cell at the right or bottom edge.
  const gridOptions = tileSizeOptions(sprite.width, sprite.height, MAX_GRID_SIZE);
  const checkerOptions = tileSizeOptions(sprite.width, sprite.height, MAX_CHECKER_SIZE);
  const effectiveGridSize = snapTileSize(gridSize, gridOptions);
  const effectiveCheckerSize = snapTileSize(checkerSize, checkerOptions);

  return (
    <div className="flex items-center gap-0.5">
      {ZOOM_ACTIONS.map(({ command, icon: Icon }) => (
        <CommandButton key={command} command={command}>
          <Icon />
        </CommandButton>
      ))}

      <Popover>
        <PopoverTrigger
          render={
            // Opens the options; the tooltip still teaches the key that toggles the grid.
            <TooltipButton
              label="Grid options"
              shortcut={commandKeys("view.toggleGrid")}
              variant={gridEnabled ? "secondary" : "ghost"}
              aria-pressed={gridEnabled}
            >
              <Grid3x3 />
            </TooltipButton>
          }
        />
        <PopoverContent gap="md" align="start" className="w-56">
          <Label size="sm" weight="normal" className="justify-between">
            Show grid
            <Switch checked={gridEnabled} onCheckedChange={toggleGrid} />
          </Label>

          <Separator />

          <Label size="sm" weight="normal" gap="sm" className="flex-col">
            Grid size · {effectiveGridSize}px
            <Slider
              min={0}
              max={gridOptions.length - 1}
              step={1}
              value={[gridOptions.indexOf(effectiveGridSize)]}
              aria-label="Grid size"
              onValueChange={(value) =>
                setGridSize(gridOptions[Array.isArray(value) ? value[0] : value])
              }
            />
          </Label>

          <Label size="sm" weight="normal" gap="sm" className="flex-col">
            Chessboard size · {effectiveCheckerSize}px
            <Slider
              min={0}
              max={checkerOptions.length - 1}
              step={1}
              value={[checkerOptions.indexOf(effectiveCheckerSize)]}
              aria-label="Chessboard size"
              onValueChange={(value) =>
                setCheckerSize(checkerOptions[Array.isArray(value) ? value[0] : value])
              }
            />
          </Label>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="mx-1 h-5" />
      <OnionSkinControl />
    </div>
  );
}
