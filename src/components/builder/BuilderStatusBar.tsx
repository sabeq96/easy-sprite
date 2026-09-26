import { Panel } from "@/components/common/Panel";
import { Separator } from "@/components/ui/separator";
import { plural } from "@/lib/format";
import type { PackedSheet } from "@/lib/sheetLayout";

export interface BuilderStatusBarProps {
  sheet: PackedSheet;
  blockCount: number;
}

/** The composer's footer, mirroring the editor's: sheet size and contents. Zoom lives in the top bar. */
export function BuilderStatusBar({ sheet, blockCount }: BuilderStatusBarProps) {
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
        {plural(blockCount, "sprite")}
      </span>
      <Separator orientation="vertical" className="h-3" />
      <span className="tabular-nums">
        {plural(rowCount, "row")}
      </span>
    </Panel>
  );
}
