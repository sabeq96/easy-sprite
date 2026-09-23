import { ChevronsDownUp, Copy, Layers, Plus, Trash2, type LucideIcon } from "lucide-react";
import { isSortable } from "@dnd-kit/react/sortable";
import { useDocumentSession } from "@/app/DocumentProvider";
import { DragBoard, type DragEndEvent } from "@/components/common/DragBoard";
import { Panel } from "@/components/common/Panel";
import { CommandButton } from "@/components/common/CommandButton";
import { LayerDragPreview, LayerRow } from "@/components/editor/LayerRow";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CommandId } from "@/commands/types";
import { reorderLayerCommand } from "@/editor/commands/layers";
import type { LayerModel } from "@/editor/document";
import { useCommandDispatch } from "@/hooks/useCommandDispatch";
import { useDropZone } from "@/hooks/useDnd";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";

const ACTIONS: { command: CommandId; icon: LucideIcon }[] = [
  { command: "layer.add", icon: Plus },
  { command: "layer.duplicate", icon: Copy },
  { command: "layer.mergeDown", icon: ChevronsDownUp },
  { command: "layer.delete", icon: Trash2 },
];

export function LayersPanel() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);

  const dispatch = useCommandDispatch();
  const activeLayerId = useEditorStore((state) => state.activeLayerId);
  const activeFrameId = useEditorStore((state) => state.activeFrameId);
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);

  // Rendered top-first: the topmost layer is the last entry in the underlying array.
  const displayLayers = [...snapshot.layers].reverse();
  const displayIds = displayLayers.map((layer) => layer.id);

  const handleDragEnd = ({ operation, canceled }: DragEndEvent) => {
    const { source } = operation;
    if (canceled || !isSortable(source) || source.initialIndex === source.index) return;
    // Indices are in display (top-first) order. The layer that sat at the landing slot before the
    // drag is the one to trade places with; reorderLayerCommand then resolves both ids to their
    // indices in the underlying bottom-first array itself, so the reversal never enters the maths.
    const overId = displayIds[source.index];
    dispatch(() =>
      reorderLayerCommand(doc, doc.layerIndex(String(source.id)), doc.layerIndex(overId)),
    );
  };

  return (
    <Panel
      render={<section aria-label="Layers" />}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <header className="flex h-8 shrink-0 items-center gap-1 rounded-t-xl bg-muted/60 px-2 text-xs font-medium text-muted-foreground">
        <Layers className="size-3.5" />
        Layers
        <div className="ml-auto flex gap-0.5">
          {ACTIONS.map(({ command, icon: Icon }) => (
            <CommandButton key={command} command={command} size="icon-xs">
              <Icon />
            </CommandButton>
          ))}
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <DragBoard
          onDrop={handleDragEnd}
          renderPreview={(_data, id) => {
            const layer = doc.getLayer(id);
            return layer ? <LayerDragPreview layer={layer} frameId={activeFrameId} /> : null;
          }}
        >
          <LayerList
            displayLayers={displayLayers}
            displayIds={displayIds}
            activeFrameId={activeFrameId}
            activeLayerId={activeLayerId}
            onSelect={setActiveLayer}
          />
        </DragBoard>
      </ScrollArea>
    </Panel>
  );
}

interface LayerListProps {
  displayLayers: LayerModel[];
  displayIds: string[];
  activeFrameId: string | null;
  activeLayerId: string | null;
  onSelect: (layerId: string) => void;
}

/**
 * Its own component, rendered as DragBoard's child, so useDropZone's monitor runs inside the
 * surrounding provider rather than above it (calling the hook back in LayersPanel would sit outside
 * it, since LayersPanel is what renders DragBoard, not what DragBoard renders).
 *
 * The list registers no droppable of its own — its rows are the targets — so the ring is claimed
 * via `owns` instead.
 */
function LayerList({ displayLayers, displayIds, activeFrameId, activeLayerId, onSelect }: LayerListProps) {
  const { ref, dropClass } = useDropZone({
    id: "layers-list",
    ringOnly: true,
    owns: (overId) => displayIds.includes(overId),
  });

  return (
    <ul ref={ref} className={cn("rounded-md", dropClass)}>
      {displayLayers.map((layer, index) => (
        <LayerRow
          key={layer.id}
          index={index}
          layer={layer}
          frameId={activeFrameId}
          isActive={layer.id === activeLayerId}
          onSelect={() => onSelect(layer.id)}
        />
      ))}
    </ul>
  );
}
