import { Panel } from "@/components/common/Panel";
import { Separator } from "@/components/ui/separator";
import type { PackedSheet } from "@/lib/sheetLayout";
import { useBuilderViewStore } from "@/stores/useBuilderViewStore";

export interface BuilderStatusBarProps {
  sheet: PackedSheet;
  blockCount: number;
}

/** The composer's footer, mirroring the editor's: sheet size and contents left, zoom right. */
export function BuilderStatusBar({ sheet, blockCount }: BuilderStatusBarProps) {
  const zoom = useBuilderViewStore((state) => state.zoom);
  const rowCount = sheet.rows.length;

  return (
    <Panel
      render={<footer />}
      className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground"
    >
      <span className="tabular-nums">
        {sheet.width}×{sheet.height}
      </span>
      <Separator orientation="vertical" className="h-3" />
      <span className="tabular-nums">
        {blockCount} {blockCount === 1 ? "sprite" : "sprites"}
      </span>
      <Separator orientation="vertical" className="h-3" />
      <span className="tabular-nums">
        {rowCount} {rowCount === 1 ? "row" : "rows"}
      </span>
      <span className="ml-auto tabular-nums">{Math.round(zoom * 100)}%</span>
    </Panel>
  );
}
