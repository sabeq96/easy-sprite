import { ChevronsDownUp, Copy, Layers, Plus, Trash2 } from "lucide-react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { TooltipButton } from "@/components/common/TooltipButton";
import { LayerRow } from "@/components/editor/LayerRow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { shortcutHint } from "@/constants/shortcuts";
import {
  addLayerCommand,
  duplicateLayerCommand,
  mergeLayerDownCommand,
  removeLayerCommand,
  reorderLayerCommand,
} from "@/editor/commands/layers";
import { useCommandDispatch } from "@/hooks/useCommandDispatch";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
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

  return (
    <section
      aria-label="Layers"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/5"
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
        {/* Rendered top-first: the topmost layer is the last entry in the array. */}
        <ul>
          {[...snapshot.layers].reverse().map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              frameId={activeFrameId}
              isActive={layer.id === activeLayerId}
              onSelect={() => setActiveLayer(layer.id)}
              onReorder={(sourceLayerId) =>
                dispatch(() =>
                  reorderLayerCommand(
                    doc,
                    doc.layerIndex(sourceLayerId),
                    doc.layerIndex(layer.id),
                  ),
                )
              }
            />
          ))}
        </ul>
      </ScrollArea>
    </section>
  );
}
