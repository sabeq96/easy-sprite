import { useState } from "react";
import { CollisionPriority } from "@dnd-kit/abstract";
import { closestCenter, pointerIntersection } from "@dnd-kit/collision";
import { KeyboardSensor, PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import { useDragDropMonitor, useDraggable, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { cn } from "@/lib/utils";

/** Pointer travel required before a drag starts — large enough that clicks on drag sources
 *  (frame select, swatch pick, popover triggers) are never eaten. */
const DRAG_ACTIVATION_DISTANCE = 4;

/** Put on a control inside a draggable that must never start a drag — a remove button, say. */
export const NO_DRAG_ATTRIBUTE = "data-no-drag";

function refusesDrag(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest(`input, textarea, select, [${NO_DRAG_ATTRIBUTE}]`) !== null)
  );
}

/**
 * Shared sensor set for every drag board in the app. Module-level on purpose: the provider applies
 * sensor changes after a deep-equality check, so a fresh `configure()` per render would churn.
 *
 * `preventActivation` is narrowed to text entry and explicit `data-no-drag` opt-outs. The library's
 * default also refuses a pointerdown on any <button> inside a draggable — but a frame card *is* its
 * thumbnail button, a swatch *is* a button, and grabbing those is the obvious way to drag them. The
 * activation distance, not the element type, is what keeps their clicks working.
 *
 * (A React `onPointerDown` stopPropagation can't opt out any more: the sensor listens natively on
 * the draggable, and sees the event before React's root listener does.)
 */
export const APP_DND_SENSORS = [
  PointerSensor.configure({
    activationConstraints: [
      new PointerActivationConstraints.Distance({ value: DRAG_ACTIVATION_DISTANCE }),
    ],
    preventActivation: (event) => refusesDrag(event.target),
  }),
  KeyboardSensor,
];

/** The floating preview under the cursor: the element exactly as it is, just see-through. */
export const DRAG_PREVIEW_CLASS = "pointer-events-none opacity-70";

/** A container the pointer is over that will accept the drop. */
export const DROP_OVER_CLASS = "ring-2 ring-primary bg-primary/5";

/**
 * The slot a dragged item leaves behind: its own box, at its own size, rendering nothing. The
 * preview follows the cursor in an overlay while the source stays in its list — and in a sortable
 * list it is the source itself that moves to the insertion point, so its empty box is what shows
 * where the drop will land.
 *
 * opacity rather than `visibility: hidden`, which would drop the item out of the accessibility
 * tree mid-drag, and rather than `display: none`, which would collapse the space entirely.
 */
export const DRAG_SLOT_CLASS = "opacity-0";

/** What the library accepts as a draggable's `data`; each site reads it back as its own union. */
type DragPayload = Record<string, unknown>;

/**
 * How a droppable decides it is under the drag.
 *
 * - `default`: the pointer, or failing that any overlap with the dragged preview's box.
 * - `nearest`: always the closest item, even past the end of the list — so a drag anywhere beyond
 *   it still targets (and rings) the list. For lists where leaving means nothing; the palette keeps
 *   `default`, because dragging a swatch *out* is how you remove it.
 * - `pointer`: only what is directly under the pointer. For boards whose preview has nothing to do
 *   with the target's geometry — an 80px dock tile would otherwise "overlap" whatever strip it
 *   brushed past on its way to the one the pointer is actually over.
 */
export type CollisionMode = "default" | "nearest" | "pointer";

const DETECTORS = {
  default: undefined,
  nearest: closestCenter,
  pointer: pointerIntersection,
} as const;

export interface DragItem {
  /** Spread onto the item's root element. `data-drag-item` gives tests a stable handle. */
  dragProps: { ref: (element: Element | null) => void; "data-drag-item": "sortable" | "source" };
  isDragging: boolean;
  /** Merge into the item's own className — turns it into the hollow slot while dragged. */
  dragClass: string;
}

export interface SortableItemOptions {
  /** Position in its list. The library needs it to project where the item is moving to. */
  index: number;
  /** Which list the item belongs to — only matters on boards with more than one. */
  group?: string;
  type?: string;
  data?: object;
  collision?: CollisionMode;
}

/**
 * A reorderable item. The ref must go on the list's *direct* child: optimistic sorting moves that
 * element among its siblings, and moving an element nested inside a wrapper would leave React's
 * idea of the tree and the real DOM disagreeing.
 */
export function useSortableItem(id: string, options: SortableItemOptions): DragItem {
  const { ref, isDragSource } = useSortable({
    id,
    index: options.index,
    group: options.group,
    type: options.type,
    data: options.data as DragPayload | undefined,
    collisionDetector: DETECTORS[options.collision ?? "default"],
  });

  return {
    dragProps: { ref, "data-drag-item": "sortable" },
    // isDragSource, not isDragging: with a drag overlay the library never marks the source itself
    // as "dragging" — that status belongs to whichever element is the visible feedback.
    isDragging: isDragSource,
    dragClass: cn("touch-none", isDragSource && DRAG_SLOT_CLASS),
  };
}

/** A drag source outside any sortable list: copy-in swatches, the composer's sprite tiles. */
export function useDragSource(id: string, options: { type?: string; data?: object } = {}): DragItem {
  const { ref, isDragSource } = useDraggable({
    id,
    type: options.type,
    data: options.data as DragPayload | undefined,
  });

  return {
    dragProps: { ref, "data-drag-item": "source" },
    isDragging: isDragSource,
    dragClass: cn("touch-none", isDragSource && DRAG_SLOT_CLASS),
  };
}

export interface DropZoneOptions {
  id: string;
  disabled?: boolean;
  /** Also count as "over" when the pointer is on one of this zone's own child droppables. */
  owns?: (overId: string) => boolean;
  /**
   * Low for a container behind its own items, so an item under the pointer wins the collision;
   * Highest for a thin strip that must beat whatever it overlaps.
   */
  priority?: "low" | "normal" | "highest";
  /** Register no droppable of its own — for a list whose items already are the targets, and which
   *  only needs to ring itself while one of them is under the pointer. */
  ringOnly?: boolean;
  collision?: CollisionMode;
}

const PRIORITIES = {
  low: CollisionPriority.Low,
  normal: undefined,
  highest: CollisionPriority.Highest,
} as const;

/**
 * A drop target that rings itself in the primary color while a drag is over it. Must be called
 * inside a DragBoard (it monitors the surrounding provider).
 */
export function useDropZone({
  id,
  disabled = false,
  owns,
  priority = "normal",
  ringOnly = false,
  collision = "default",
}: DropZoneOptions) {
  const { ref } = useDroppable({
    id,
    disabled: disabled || ringOnly,
    collisionPriority: PRIORITIES[priority],
    collisionDetector: DETECTORS[collision],
  });
  const [isOver, setOver] = useState(false);

  // Monitored rather than read off the droppable's own `isDropTarget`, for two reasons: the
  // highlight has to survive the pointer landing on a child droppable (a swatch wins that collision
  // over the grid it sits in), and this re-renders only when the boolean flips rather than on every
  // target change. It is a pure read of the drag's target and never feeds back into collisions.
  useDragDropMonitor({
    onDragOver: ({ operation }) => {
      const overId = operation.target ? String(operation.target.id) : null;
      setOver(!disabled && overId !== null && (overId === id || (owns?.(overId) ?? false)));
    },
    onDragEnd: () => setOver(false),
  });

  return { ref, isOver, dropClass: cn("transition-colors", isOver && DROP_OVER_CLASS) };
}
