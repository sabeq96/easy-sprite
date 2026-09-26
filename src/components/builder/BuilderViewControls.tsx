import { GridOptionsPopover } from "@/components/common/GridOptionsPopover";
import { ZoomControls } from "@/components/common/ZoomControls";
import { BUILDER_ZOOM_LEVELS } from "@/constants/builder";
import { snapTileSize } from "@/editor/grid";
import { sheetTileOptions } from "@/lib/tiles";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";

/** The composer's ViewControls: the shared zoom and grid controls over the builder's view store. */
export function BuilderViewControls({ tileSize }: { tileSize: number }) {
  const zoom = useBuilderViewStore((state) => state.zoom);
  const gridEnabled = useBuilderViewStore((state) => state.gridEnabled);
  const toggleGrid = useBuilderViewStore((state) => state.toggleGrid);
  const gridSize = useBuilderViewStore((state) => state.gridSize);
  const setGridSize = useBuilderViewStore((state) => state.setGridSize);
  const checkerSize = useBuilderViewStore((state) => state.checkerSize);
  const setCheckerSize = useBuilderViewStore((state) => state.setCheckerSize);

  const options = sheetTileOptions(tileSize);

  return (
    <div className="flex items-center gap-0.5">
      <ZoomControls zoom={zoom} levels={BUILDER_ZOOM_LEVELS} />
      <GridOptionsPopover
        enabled={gridEnabled}
        onEnabledChange={toggleGrid}
        gridSize={snapTileSize(gridSize, options)}
        gridOptions={options}
        onGridSizeChange={setGridSize}
        checkerSize={snapTileSize(checkerSize, options)}
        checkerOptions={options}
        onCheckerSizeChange={setCheckerSize}
      />
    </div>
  );
}
