import type { ReactNode } from "react";
import type { DragEndEvent, DragMoveEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/dom";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { APP_DND_SENSORS, DRAG_PREVIEW_CLASS } from "@/hooks/useDnd";

export type { DragEndEvent, DragMoveEvent, DragOverEvent, DragStartEvent };

export interface DragBoardProps<TData> {
  /** The dragged element's own visual, to follow the cursor. Styling comes from the board. */
  renderPreview: (data: TData, id: string) => ReactNode;
  onDragStart?: (event: DragStartEvent) => void;
  /** Boards that move items *between* lists, or copy new ones in, update their state here. */
  onDragOver?: (event: DragOverEvent) => void;
  /**
   * Every pointer move. `onDragOver` fires only when the target *changes*, so a board whose
   * placement depends on where inside the target the pointer is has to re-check here too.
   */
  onDragMove?: (event: DragMoveEvent) => void;
  /** Fires for drops and for cancels alike — check `event.canceled`. */
  onDrop: (event: DragEndEvent) => void;
  /** Free-placement boards skip the overlay's return animation, so the drop reads as instant. */
  animateDrop?: boolean;
  children: ReactNode;
}

/**
 * Every drag in the app runs through here, so they all share one set of visuals: the dragged
 * element's own preview follows the cursor in an overlay, a container under it rings itself in the
 * primary color, and a sortable item leaves a hollow slot that travels to its insertion point.
 *
 * A single sortable list needs nothing but `onDrop`: the library reorders the DOM live while the
 * drag is in flight and restores it by itself on cancel, so the handler only commits the final
 * `initialIndex → index` move. Boards that move items between lists, or inject a preview of an
 * item being copied in, keep their own draft in `onDragOver`.
 */
export function DragBoard<TData>({
  renderPreview,
  onDragStart,
  onDragOver,
  onDragMove,
  onDrop,
  animateDrop = true,
  children,
}: DragBoardProps<TData>) {
  return (
    <DragDropProvider
      sensors={APP_DND_SENSORS}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragMove={onDragMove}
      onDragEnd={onDrop}
    >
      {children}

      {/* Promoted to the top layer while dragging, so a preview can leave a scrolling dock or a
          clipped panel. `fixed` keeps its (empty) element out of layout at rest too — it renders
          where the board does, and would otherwise be one more item in the parent's grid or flex
          row, adding a gap that vanishes the moment a drag starts. */}
      <DragOverlay className="fixed" dropAnimation={animateDrop ? undefined : null}>
        {(source) => (
          <div className={DRAG_PREVIEW_CLASS}>
            {renderPreview(source.data as TData, String(source.id))}
          </div>
        )}
      </DragOverlay>
    </DragDropProvider>
  );
}
