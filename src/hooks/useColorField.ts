import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { clamp } from "@/lib/math";

export interface ColorField {
  ref: RefObject<HTMLDivElement | null>;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

/**
 * Turns pointer drags on a rectangle into normalised (x, y) in 0–1, with capture so the drag
 * continues outside the element. Shared by the SV square, hue strip and alpha strip.
 */
export function useColorField(onChange: (x: number, y: number) => void): ColorField {
  const ref = useRef<HTMLDivElement>(null);

  const handle = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    onChange(
      clamp((event.clientX - rect.left) / rect.width, 0, 1),
      clamp((event.clientY - rect.top) / rect.height, 0, 1),
    );
  };

  return {
    ref,
    onPointerDown: (event) => {
      ref.current?.setPointerCapture(event.pointerId);
      handle(event);
    },
    onPointerMove: (event) => {
      if (event.buttons === 1) handle(event);
    },
  };
}
