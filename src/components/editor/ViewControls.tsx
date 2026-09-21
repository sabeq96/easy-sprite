import { Grid3x3, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { TooltipButton } from "@/components/common/TooltipButton";
import { OnionSkinControl } from "@/components/editor/OnionSkinControl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { GRID_SIZE_OPTIONS } from "@/constants/canvas";
import { shortcutHint } from "@/constants/shortcuts";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { useEditorStore } from "@/stores/useEditorStore";

export function ViewControls() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);
  const gridEnabled = useEditorStore((state) => state.gridEnabled);
  const toggleGrid = useEditorStore((state) => state.toggleGrid);
  const gridSize = useEditorStore((state) => state.gridSize);
  const setGridSize = useEditorStore((state) => state.setGridSize);
  const zoom = useEditorStore((state) => state.zoom);
  const containerSize = useEditorStore((state) => state.containerSize);
  const fitToContainer = useEditorStore((state) => state.fitToContainer);

  const sprite = { width: snapshot.width, height: snapshot.height };
  const centre = { x: containerSize.width / 2, y: containerSize.height / 2 };

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

      <DropdownMenu>
        <DropdownMenuTrigger
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
        <DropdownMenuContent align="start" className="min-w-40">
          <DropdownMenuCheckboxItem checked={gridEnabled} onCheckedChange={toggleGrid}>
            Show grid
            <DropdownMenuShortcut>{shortcutHint("view.toggleGrid")}</DropdownMenuShortcut>
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={String(gridSize)}
            onValueChange={(value) => setGridSize(Number(value))}
          >
            {GRID_SIZE_OPTIONS.map((size) => (
              <DropdownMenuRadioItem key={size} value={String(size)}>
                {size} × {size} px
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-5" />
      <OnionSkinControl />
    </div>
  );
}
