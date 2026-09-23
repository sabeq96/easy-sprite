import { ChevronsDownUp, Copy, Layers, Plus, Trash2 } from "lucide-react";
import { isSortable } from "@dnd-kit/react/sortable";
import { useDocumentSession } from "@/app/DocumentProvider";
import { DragBoard, type DragEndEvent } from "@/components/common/DragBoard";
import { Panel } from "@/components/common/Panel";
import { TooltipButton } from "@/components/common/TooltipButton";
import { LayerDragPreview, LayerRow } from "@/components/editor/LayerRow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { shortcutHint } from "@/constants/shortcuts";
import {
  addLayerCommand,
  duplicateLayerCommand,
  mergeLayerDownCommand,
  removeLayerCommand,
  reorderLayerCommand,
} from "@/editor/commands/layers";
import type { LayerModel } from "@/editor/document";
import { useCommandDispatch } from "@/hooks/useCommandDispatch";
import { useDropZone } from "@/hooks/useDnd";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";

export function LayersPanel() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);

  const dispatch = useCommandDispatch();
  const activeLayerId = useEditorStore((state) => state.activeLayerId);
  const activeFrameId = useEditorStore((state) => state.activeFrameId);
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);

  const activeIndex = snapshot.layers.findIndex((layer) => layer.id === activeLayerId);

  const actions = [
    {
      label: "Add layer",
      shortcut: shortcutHint("layer.add"),
      icon: Plus,
      disabled: false,
      run: () => dispatch(() => addLayerCommand(doc, activeLayerId ?? undefined)),
    },
    {
      label: "Duplicate layer",
      shortcut: undefined,
      icon: Copy,
      disabled: !activeLayerId,
      run: () => activeLayerId && dispatch(() => duplicateLayerCommand(doc, activeLayerId)),
    },
    {
      label: "Merge down",
      shortcut: shortcutHint("layer.mergeDown"),
      icon: ChevronsDownUp,
      disabled: activeIndex <= 0,
      run: () => activeLayerId && dispatch(() => mergeLayerDownCommand(doc, activeLayerId)),
    },
    {
      label: "Delete layer",
      shortcut: undefined,
      icon: Trash2,
      disabled: snapshot.layers.length <= 1 || !activeLayerId,
      run: () => activeLayerId && dispatch(() => removeLayerCommand(doc, activeLayerId)),
    },
  ];

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
          {actions.map(({ label, shortcut, icon: Icon, disabled, run }) => (
            <TooltipButton
              key={label}
              label={label}
              shortcut={shortcut}
              size="icon-xs"
              disabled={disabled}
              onClick={run}
            >
              <Icon />
            </TooltipButton>
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
