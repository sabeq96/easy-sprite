import { Plus } from "lucide-react";
import { isSortable } from "@dnd-kit/react/sortable";
import { useDocumentSession } from "@/app/DocumentProvider";
import { DragBoard, type DragEndEvent } from "@/components/common/DragBoard";
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
import type { FrameModel } from "@/editor/document";
import { useCommandDispatch } from "@/hooks/useCommandDispatch";
import { useDropZone } from "@/hooks/useDnd";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";

export function FramesBar() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);
  const dispatch = useCommandDispatch();
  const activeFrameId = useEditorStore((state) => state.activeFrameId);
  const setActiveFrame = useEditorStore((state) => state.setActiveFrame);

  const frameIds = snapshot.frames.map((frame) => frame.id);

  // The strip was already reordered live during the drag (and restored on cancel), so a drop only
  // has to commit where the card ended up.
  const handleDragEnd = ({ operation, canceled }: DragEndEvent) => {
    const { source } = operation;
    if (canceled || !isSortable(source) || source.initialIndex === source.index) return;
    dispatch(() => moveFrameCommand(doc, source.initialIndex, source.index));
  };

  return (
    <Panel className="flex items-center gap-2 p-2">
      <DragBoard
        onDrop={handleDragEnd}
        renderPreview={(_data, id) => (
          <FrameDragPreview frameId={id} index={Math.max(frameIds.indexOf(id), 0)} />
        )}
      >
        <ScrollArea className="min-w-0 flex-1">
          <FrameStrip
            frames={snapshot.frames}
            frameIds={frameIds}
            activeFrameId={activeFrameId}
            onSelect={setActiveFrame}
            onDuplicate={(frameId) => dispatch(() => duplicateFrameCommand(doc, frameId))}
            onDelete={(frameId) => dispatch(() => removeFrameCommand(doc, frameId))}
          />
        </ScrollArea>
      </DragBoard>

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

interface FrameStripProps {
  frames: FrameModel[];
  frameIds: string[];
  activeFrameId: string | null;
  onSelect: (frameId: string) => void;
  onDuplicate: (frameId: string) => void;
  onDelete: (frameId: string) => void;
}

/**
 * Its own component, rendered as DragBoard's child, so useDropZone's monitor runs inside the
 * surrounding provider rather than above it (calling the hook back in FramesBar would sit outside
 * it, since FramesBar is what renders DragBoard, not what DragBoard renders).
 *
 * The strip registers no droppable of its own — its cards are the targets — so the ring is claimed
 * via `owns` instead.
 */
function FrameStrip({
  frames,
  frameIds,
  activeFrameId,
  onSelect,
  onDuplicate,
  onDelete,
}: FrameStripProps) {
  const { ref, dropClass } = useDropZone({
    id: "frames-strip",
    ringOnly: true,
    owns: (overId) => frameIds.includes(overId),
  });

  return (
    <ol ref={ref} className={cn("flex gap-2 rounded-md", dropClass)}>
      {frames.map((frame, index) => (
        <FrameCard
          key={frame.id}
          frameId={frame.id}
          index={index}
          isActive={frame.id === activeFrameId}
          canDelete={frames.length > 1}
          onSelect={() => onSelect(frame.id)}
          onDuplicate={() => onDuplicate(frame.id)}
          onDelete={() => onDelete(frame.id)}
        />
      ))}
    </ol>
  );
}
