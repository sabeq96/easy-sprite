import { useDocumentSession } from "@/app/DocumentProvider";
import { Separator } from "@/components/ui/separator";
import { useDocumentRevision } from "@/hooks/useDocumentRevision";
import { rgbaToHex } from "@/lib/color";
import { useCursorStore } from "@/stores/useCursorStore";
import { useEditorStore } from "@/stores/useEditorStore";

export function EditorStatusBar() {
  const { doc } = useDocumentSession();
  useDocumentRevision(doc, "structure");
  useDocumentRevision(doc, "meta");

  const position = useCursorStore((state) => state.position);
  const color = useCursorStore((state) => state.color);
  const scale = useEditorStore((state) => state.viewport.scale);
  const activeFrameId = useEditorStore((state) => state.activeFrameId);
  const activeLayerId = useEditorStore((state) => state.activeLayerId);

  const frameNumber = activeFrameId ? doc.frameIndex(activeFrameId) + 1 : 1;
  const layerName = activeLayerId ? (doc.getLayer(activeLayerId)?.name ?? "—") : "—";

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
        {doc.width}×{doc.height}
      </span>
      <Separator orientation="vertical" className="h-3" />
      <span className="tabular-nums">
        Frame {frameNumber}/{doc.frames.length}
      </span>
      <Separator orientation="vertical" className="h-3" />
      <span className="truncate">{layerName}</span>

      <span className="ml-auto tabular-nums">{Math.round(scale * 100)}%</span>
    </footer>
  );
}
