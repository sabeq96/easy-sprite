import { KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

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
