import { useState } from "react";
import { Eye, EyeOff, Lock, LockOpen } from "lucide-react";
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
  onReorder: (sourceLayerId: string) => void;
}

export function LayerRow({ layer, frameId, isActive, onSelect, onReorder }: LayerRowProps) {
  const { doc } = useDocumentSession();
  const dispatch = useCommandDispatch();
  const [isRenaming, setRenaming] = useState(false);

  const toggle = (patch: Partial<LayerModel>, label: string) =>
    dispatch(() => setLayerPropsCommand(doc, layer.id, patch, label));

  return (
    <li
      data-active={isActive || undefined}
      className={cn(
        "mx-1 my-0.5 flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors",
        "hover:bg-muted/50 data-active:bg-muted",
      )}
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/layer-id", layer.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const sourceId = event.dataTransfer.getData("text/layer-id");
        if (sourceId && sourceId !== layer.id) onReorder(sourceId);
      }}
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
        // Typing must never reach the global shortcut handler.
        event.stopPropagation();
        if (event.key === "Enter") commit();
        if (event.key === "Escape") onDone();
      }}
    />
  );
}
