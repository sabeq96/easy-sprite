import { useDocumentSession } from "@/app/DocumentProvider";
import { Panel } from "@/components/common/Panel";
import { Separator } from "@/components/ui/separator";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { rgbaToHex } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useCursorStore } from "@/stores/useCursorStore";
import { useEditorStore } from "@/stores/useEditorStore";

export function EditorStatusBar() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);

  const position = useCursorStore((state) => state.position);
  const color = useCursorStore((state) => state.color);
  const scale = useEditorStore((state) => state.viewport.scale);
  const activeFrameId = useEditorStore((state) => state.activeFrameId);
  const activeLayerId = useEditorStore((state) => state.activeLayerId);

  const frameNumber =
    snapshot.frames.findIndex((frame) => frame.id === activeFrameId) + 1;
  const layerName =
    snapshot.layers.find((layer) => layer.id === activeLayerId)?.name ?? "—";
  const hex = color && color.a > 0 ? rgbaToHex(color) : null;

  return (
    <Panel render={<footer />} className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
      <span className="w-16 tabular-nums">
        {position ? `${position.x}, ${position.y}` : "–, –"}
      </span>

      <span
        aria-hidden
        className={cn(
          "size-3 shrink-0 rounded-sm ring-1 ring-foreground/15",
          !hex && "bg-transparent",
        )}
        style={hex ? { backgroundColor: hex } : undefined}
      />
      <span className="w-16 tabular-nums">{hex ?? "–"}</span>

      <Separator orientation="vertical" className="h-3" />
      <span className="tabular-nums">
        {snapshot.width}×{snapshot.height}
      </span>
      <Separator orientation="vertical" className="h-3" />
      <span className="tabular-nums">
        Frame {Math.max(1, frameNumber)}/{snapshot.frames.length}
      </span>
      <Separator orientation="vertical" className="h-3" />
      <span className="truncate">{layerName}</span>

      <span className="ml-auto tabular-nums">{Math.round(scale * 100)}%</span>
    </Panel>
  );
}
