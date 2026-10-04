import { Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { CommandButton } from "@/components/common/CommandButton";
import { formatZoom } from "@/lib/format";

export interface ZoomControlsProps {
  zoom: number;
  /**
   * The editor's zoom ladder, ascending, so − and + disable at its ends. The `disabled` it gives
   * them takes precedence over the commands' `isEnabled`, which CommandButton also follows live
   * through the provider's `subscribe`; both read the same ladder, so they agree.
   */
  levels: readonly number[];
}

/**
 * `− 8× +` and fit, shared by the Editor and the Builder. Bound to `view.zoomOut`, `view.zoomIn`
 * and `view.fit`, so it needs a CommandsProvider that registers them.
 */
export function ZoomControls({ zoom, levels }: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-0.5">
      <CommandButton command="view.zoomOut" disabled={zoom <= levels[0]}>
        <ZoomOut />
      </CommandButton>

      <output
        aria-label="Zoom level"
        className="w-9 text-center text-xs tabular-nums text-muted-foreground"
      >
        {formatZoom(zoom)}
      </output>

      <CommandButton command="view.zoomIn" disabled={zoom >= levels[levels.length - 1]}>
        <ZoomIn />
      </CommandButton>

      <CommandButton command="view.fit">
        <Maximize />
      </CommandButton>
    </div>
  );
}
