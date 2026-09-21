import { Grid3x3, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { TooltipButton } from "@/components/common/TooltipButton";
import { OnionSkinControl } from "@/components/editor/OnionSkinControl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { MAX_CHECKER_SIZE, MAX_GRID_SIZE } from "@/constants/canvas";
import { shortcutHint } from "@/constants/shortcuts";
import { snapTileSize, tileSizeOptions } from "@/editor/grid";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { useEditorStore } from "@/stores/useEditorStore";

export function ViewControls() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);
  const gridEnabled = useEditorStore((state) => state.gridEnabled);
  const toggleGrid = useEditorStore((state) => state.toggleGrid);
  const gridSize = useEditorStore((state) => state.gridSize);
  const setGridSize = useEditorStore((state) => state.setGridSize);
  const checkerSize = useEditorStore((state) => state.checkerSize);
  const setCheckerSize = useEditorStore((state) => state.setCheckerSize);
  const zoom = useEditorStore((state) => state.zoom);
  const containerSize = useEditorStore((state) => state.containerSize);
  const fitToContainer = useEditorStore((state) => state.fitToContainer);

  const sprite = { width: snapshot.width, height: snapshot.height };
  const centre = { x: containerSize.width / 2, y: containerSize.height / 2 };

  // Only sizes that evenly divide the sprite's width and height, so the grid/checkerboard never
  // clips a partial cell at the right or bottom edge.
  const gridOptions = tileSizeOptions(sprite.width, sprite.height, MAX_GRID_SIZE);
  const checkerOptions = tileSizeOptions(sprite.width, sprite.height, MAX_CHECKER_SIZE);
  const effectiveGridSize = snapTileSize(gridSize, gridOptions);
  const effectiveCheckerSize = snapTileSize(checkerSize, checkerOptions);

  const buttons = [
    {
      label: "Zoom out",
      shortcut: shortcutHint("view.zoomOut"),
      icon: ZoomOut,
      run: () => zoom(centre, -1, sprite),
    },
    {
      label: "Zoom in",
      shortcut: shortcutHint("view.zoomIn"),
      icon: ZoomIn,
      run: () => zoom(centre, 1, sprite),
    },
    {
      label: "Fit to window",
      shortcut: shortcutHint("view.fit"),
      icon: Maximize,
      run: () => fitToContainer(containerSize, sprite),
    },
  ];

  return (
    <div className="flex items-center gap-0.5">
      {buttons.map(({ label, shortcut, icon: Icon, run }) => (
        <TooltipButton key={label} label={label} shortcut={shortcut} onClick={run}>
          <Icon />
        </TooltipButton>
      ))}

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
