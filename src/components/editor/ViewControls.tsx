import { useDocumentSession } from "@/app/DocumentProvider";
import { GridOptionsPopover } from "@/components/common/GridOptionsPopover";
import { ZoomControls } from "@/components/common/ZoomControls";
import { OnionSkinControl } from "@/components/editor/OnionSkinControl";
import { Separator } from "@/components/ui/separator";
import { MAX_CHECKER_SIZE, MAX_GRID_SIZE, ZOOM_LEVELS } from "@/constants/canvas";
import { snapTileSize, tileSizeOptions } from "@/editor/grid";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { useEditorStore } from "@/stores/useEditorStore";

export function ViewControls() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);
  const scale = useEditorStore((state) => state.viewport.scale);
  const gridEnabled = useEditorStore((state) => state.gridEnabled);
  const toggleGrid = useEditorStore((state) => state.toggleGrid);
  const gridSize = useEditorStore((state) => state.gridSize);
  const setGridSize = useEditorStore((state) => state.setGridSize);
  const checkerSize = useEditorStore((state) => state.checkerSize);
  const setCheckerSize = useEditorStore((state) => state.setCheckerSize);

  // Only sizes that evenly divide the sprite's width and height, so the grid/checkerboard never
  // clips a partial cell at the right or bottom edge.
  const gridOptions = tileSizeOptions(snapshot.width, snapshot.height, MAX_GRID_SIZE);
  const checkerOptions = tileSizeOptions(snapshot.width, snapshot.height, MAX_CHECKER_SIZE);

  return (
    <div className="flex items-center gap-0.5">
      <ZoomControls zoom={scale} levels={ZOOM_LEVELS} />

      <GridOptionsPopover
        enabled={gridEnabled}
        onEnabledChange={toggleGrid}
        gridSize={snapTileSize(gridSize, gridOptions)}
        gridOptions={gridOptions}
        onGridSizeChange={setGridSize}
        checkerSize={snapTileSize(checkerSize, checkerOptions)}
        checkerOptions={checkerOptions}
        onCheckerSizeChange={setCheckerSize}
      />

      <Separator orientation="vertical" className="mx-1 h-5" />
      <OnionSkinControl />
    </div>
  );
}
