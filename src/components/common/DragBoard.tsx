import { useState, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, type SortingStrategy } from "@dnd-kit/sortable";
import { DRAG_PREVIEW_CLASS, useAppDndSensors } from "@/hooks/useDnd";

export interface DragBoardProps<TData> {
  /** Item ids in display order — pass them to make the board reorderable. */
  items?: string[];
  strategy?: SortingStrategy;
  collisionDetection?: CollisionDetection;
  /** The dragged element's own visual, to follow the cursor. Styling comes from the board. */
  renderPreview: (data: TData, id: string) => ReactNode;
  onDrop: (event: DragEndEvent) => void;
  /** Free-placement boards skip the overlay's snap-back, so the drop reads as instant. */
  animateDrop?: boolean;
  children: ReactNode;
}

/**
 * Every drag in the app runs through here, so they all share one set of visuals: the dragged
 * element follows the cursor, a container under it rings itself in the primary color, and a
 * reorderable item leaves a hollow slot at its insertion point.
 */
export function DragBoard<TData>({
  items,
  strategy,
  collisionDetection = closestCenter,
  renderPreview,
  onDrop,
  animateDrop = true,
  children,
}: DragBoardProps<TData>) {
  const sensors = useAppDndSensors();
  const [dragging, setDragging] = useState<{ id: string; data: TData } | null>(null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={({ active }) =>
        setDragging({ id: String(active.id), data: active.data.current as TData })
      }
      onDragEnd={(event) => {
        setDragging(null);
        onDrop(event);
      }}
      onDragCancel={() => setDragging(null)}
    >
      {items ? (
        <SortableContext items={items} strategy={strategy}>
          {children}
        </SortableContext>
      ) : (
        children
      )}

      {/* Portalled out of the tree, so a preview can leave a scrolling dock or a clipped panel. */}
      <DragOverlay dropAnimation={animateDrop ? undefined : null}>
        {dragging && (
          <div className={DRAG_PREVIEW_CLASS}>{renderPreview(dragging.data, dragging.id)}</div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
