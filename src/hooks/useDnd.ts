import { useState } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useDndMonitor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

/** Pointer travel required before a drag starts — large enough that clicks on drag sources
 *  (frame select, swatch pick, popover triggers) are never eaten. */
const DRAG_ACTIVATION_DISTANCE = 4;

/** Shared sensor set for every DndContext in the app. */
export function useAppDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

/** The floating preview under the cursor: the element exactly as it is, just see-through. */
export const DRAG_PREVIEW_CLASS = "pointer-events-none opacity-70";

/** A container the pointer is over that will accept the drop. */
export const DROP_OVER_CLASS = "ring-2 ring-primary bg-primary/5";

/**
 * The slot a dragged item leaves behind: its own box, at its own size, rendering nothing — the
 * neighbours shift around it, so the empty space is what shows where the drop will land.
 *
 * opacity rather than `visibility: hidden`, which would drop the item out of the accessibility
 * tree mid-drag, and rather than `display: none`, which would collapse the space entirely.
 */
export const DRAG_SLOT_CLASS = "opacity-0";

/** What dnd-kit accepts as a draggable's `data`; each site reads it back as its own union. */
type DragPayload = Record<string, unknown>;

export interface DragItem {
  dragProps: Record<string, unknown>;
  isDragging: boolean;
  /** Merge into the item's own className — turns it into the hollow slot while dragged. */
  dragClass: string;
}

/** A reorderable item: renders as a hollow slot at its insertion point while dragged. */
export function useSortableItem(id: string, data?: object): DragItem {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: data as DragPayload,
  });

  return {
    dragProps: {
      ref: setNodeRef,
      style: { transform: CSS.Transform.toString(transform), transition },
      ...attributes,
      ...listeners,
    },
    isDragging,
    dragClass: cn("touch-none", isDragging && DRAG_SLOT_CLASS),
  };
}

/** A drag source outside any sortable list: copy-in swatches, freely placed blocks. */
export function useDragSource(id: string, data?: object): DragItem {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: data as DragPayload,
  });

  return {
    dragProps: { ref: setNodeRef, ...attributes, ...listeners },
    isDragging,
    dragClass: cn("touch-none", isDragging && DRAG_SLOT_CLASS),
  };
}

export interface DropZoneOptions {
  id: string;
  disabled?: boolean;
  /** Also count as "over" when the pointer is on one of this zone's own child droppables. */
  owns?: (overId: string) => boolean;
}

/**
 * A drop target that rings itself in the primary color while a drag is over it. Must be called
 * inside a DragBoard (it monitors the surrounding DndContext).
 */
export function useDropZone({ id, disabled = false, owns }: DropZoneOptions) {
  const { setNodeRef } = useDroppable({ id, disabled });
  const [isOver, setOver] = useState(false);

  // Monitored rather than read off useDroppable's own `isOver`, for two reasons: the highlight has
  // to survive the pointer landing on a child droppable (a palette swatch wins that collision over
  // the grid it sits in), and this re-renders only when the boolean flips rather than on every
  // pointer move. It is a pure read of dnd-kit's `over` result that never feeds back into layout
  // or collision detection, so it can't create the update loop a synthetic placeholder did.
  useDndMonitor({
    onDragOver: ({ over }) => {
      const overId = over ? String(over.id) : null;
      setOver(!disabled && overId !== null && (overId === id || (owns?.(overId) ?? false)));
    },
    onDragEnd: () => setOver(false),
    onDragCancel: () => setOver(false),
  });

  return { ref: setNodeRef, isOver, dropClass: cn("transition-colors", isOver && DROP_OVER_CLASS) };
}
