import { useState } from "react";
import { Plus } from "lucide-react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { useDocumentSession } from "@/app/DocumentProvider";
import { Panel } from "@/components/common/Panel";
import { FrameCard, FrameDragPreview } from "@/components/editor/FrameCard";
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
import { useAppDndSensors } from "@/lib/dnd";
import { useEditorStore } from "@/stores/useEditorStore";

export function FramesBar() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);
  const dispatch = useCommandDispatch();
  const activeFrameId = useEditorStore((state) => state.activeFrameId);
  const setActiveFrame = useEditorStore((state) => state.setActiveFrame);
  const sensors = useAppDndSensors();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const frameIds = snapshot.frames.map((frame) => frame.id);
  const draggingIndex = draggingId ? frameIds.indexOf(draggingId) : -1;

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null);
    if (!over || active.id === over.id) return;
    const from = frameIds.indexOf(String(active.id));
    const to = frameIds.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    dispatch(() => moveFrameCommand(doc, from, to));
  };

  return (
    <Panel className="flex items-center gap-2 p-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event: DragStartEvent) => setDraggingId(String(event.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <ScrollArea className="min-w-0 flex-1">
          <SortableContext items={frameIds} strategy={horizontalListSortingStrategy}>
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
                  />
                </li>
              ))}
            </ol>
          </SortableContext>
        </ScrollArea>
        <DragOverlay>
          {draggingId ? (
            <FrameDragPreview frameId={draggingId} index={Math.max(draggingIndex, 0)} />
          ) : null}
        </DragOverlay>
      </DndContext>

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
    </Panel>
  );
}
