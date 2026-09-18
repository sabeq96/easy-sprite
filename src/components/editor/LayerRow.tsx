import { useState } from "react";
import { Eye, EyeOff, Lock, LockOpen } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDocumentSession } from "@/app/DocumentProvider";
import { LayerOpacityControl } from "@/components/editor/LayerOpacityControl";
import { LayerThumbnail } from "@/components/editor/LayerThumbnail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setLayerPropsCommand } from "@/editor/commands/layers";
import type { LayerModel } from "@/editor/document";
import { useCommandDispatch } from "@/hooks/useCommandDispatch";
import { cn } from "@/lib/utils";

export interface LayerRowProps {
  layer: LayerModel;
  frameId: string | null;
  isActive: boolean;
  onSelect: () => void;
}

export function LayerRow({ layer, frameId, isActive, onSelect }: LayerRowProps) {
  const { doc } = useDocumentSession();
  const dispatch = useCommandDispatch();
  const [isRenaming, setRenaming] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: layer.id,
  });

  const toggle = (patch: Partial<LayerModel>, label: string) =>
    dispatch(() => setLayerPropsCommand(doc, layer.id, patch, label));

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-active={isActive || undefined}
      {...attributes}
      {...listeners}
      className={cn(
        "mx-1 my-0.5 flex touch-none items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors",
        "hover:bg-muted/50 data-active:bg-muted",
        isDragging && "opacity-40",
      )}
    >
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
        aria-pressed={layer.visible}
        onClick={() => toggle({ visible: !layer.visible }, "Toggle layer visibility")}
      >
        {layer.visible ? <Eye /> : <EyeOff className="opacity-40" />}
      </Button>

      <LayerThumbnail layerId={layer.id} frameId={frameId} />

      {isRenaming ? (
        <LayerNameInput layer={layer} onDone={() => setRenaming(false)} />
      ) : (
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-xs"
          onClick={onSelect}
          onDoubleClick={() => setRenaming(true)}
        >
          {layer.name}
        </button>
      )}

      <LayerOpacityControl layer={layer} />

      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
        aria-pressed={layer.locked}
        onClick={() => toggle({ locked: !layer.locked }, "Toggle layer lock")}
      >
        {layer.locked ? <Lock /> : <LockOpen className="opacity-30" />}
      </Button>
    </li>
  );
}

/** Floating preview rendered inside LayersPanel's DragOverlay. */
export function LayerDragPreview({ layer, frameId }: { layer: LayerModel; frameId: string | null }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-card px-1.5 py-1 shadow-lg ring-2 ring-primary/60">
      {layer.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5 opacity-40" />}
      <LayerThumbnail layerId={layer.id} frameId={frameId} />
      <span className="max-w-32 truncate text-xs">{layer.name}</span>
    </div>
  );
}

function LayerNameInput({ layer, onDone }: { layer: LayerModel; onDone: () => void }) {
  const { doc } = useDocumentSession();
  const dispatch = useCommandDispatch();
  const [draft, setDraft] = useState(layer.name);

  const commit = () => {
    const name = draft.trim();
    if (name && name !== layer.name) {
      dispatch(() => setLayerPropsCommand(doc, layer.id, { name }, "Rename layer"));
    }
    onDone();
  };

  return (
    <Input
      autoFocus
      className="h-6 flex-1 text-xs"
      aria-label="Layer name"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        // Typing must never reach the global shortcut handler — this also conveniently keeps
        // typing out of KeyboardSensor's drag-activation keys.
        event.stopPropagation();
        if (event.key === "Enter") commit();
        if (event.key === "Escape") onDone();
      }}
    />
  );
}
