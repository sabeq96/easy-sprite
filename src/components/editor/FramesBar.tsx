import { useState } from "react";
import { Plus } from "lucide-react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { FrameCard } from "@/components/editor/FrameCard";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { shortcutHint } from "@/constants/shortcuts";
import {
  addFrameCommand,
  duplicateFrameCommand,
  moveFrameCommand,
  removeFrameCommand,
} from "@/editor/commands/frames";
import { useCommandDispatch } from "@/hooks/useCommandDispatch";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { useEditorStore } from "@/stores/useEditorStore";

export function FramesBar() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);

  const dispatch = useCommandDispatch();
  const activeFrameId = useEditorStore((state) => state.activeFrameId);
  const setActiveFrame = useEditorStore((state) => state.setActiveFrame);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <div className="flex items-center gap-2 rounded-xl bg-card p-2 shadow-sm ring-1 ring-foreground/5">
      <ScrollArea className="min-w-0 flex-1">
        <ol className="flex gap-2">
          {snapshot.frames.map((frame, index) => (
            <li key={frame.id}>
              <FrameCard
                frameId={frame.id}
                index={index}
                isActive={frame.id === activeFrameId}
                canDelete={snapshot.frames.length > 1}
                onSelect={() => setActiveFrame(frame.id)}
                onDuplicate={() => dispatch(() => duplicateFrameCommand(doc, frame.id))}
                onDelete={() => dispatch(() => removeFrameCommand(doc, frame.id))}
                onDragStart={() => setDragIndex(index)}
                onDrop={() => {
                  if (dragIndex !== null) dispatch(() => moveFrameCommand(doc, dragIndex, index));
                  setDragIndex(null);
                }}
              />
            </li>
          ))}
        </ol>
      </ScrollArea>

      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => dispatch(() => addFrameCommand(doc, activeFrameId ?? undefined))}
          >
            <Plus />
            Frame
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Add frame
          <Kbd>{shortcutHint("frame.add")}</Kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
