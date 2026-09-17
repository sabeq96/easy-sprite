import { useDocumentSession } from "@/app/DocumentProvider";
import { Separator } from "@/components/ui/separator";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { rgbaToHex } from "@/lib/color";
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

  const frameNumber = snapshot.frames.findIndex((frame) => frame.id === activeFrameId) + 1;
  const layerName =
    snapshot.layers.find((layer) => layer.id === activeLayerId)?.name ?? "—";

  return (
    <footer className="flex items-center gap-2 border-t px-3 text-xs text-muted-foreground">
      <span className="w-24 tabular-nums">
        {position ? `${position.x}, ${position.y}` : "–, –"}
      </span>

      {color && color.a > 0 && (
        <>
          <span
            aria-hidden
            className="size-3 rounded-xs border"
            style={{ backgroundColor: rgbaToHex(color) }}
          />
          <span className="tabular-nums">{rgbaToHex(color)}</span>
        </>
      )}

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
    </footer>
  );
}
