import { expect } from "vitest";

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

/**
 * Waits until `find` returns an element whose box has stopped moving, then returns it.
 *
 * A drag aimed at geometry measured too early is the classic flake here: live queries (the sprite
 * dock, the palette) render a beat after the page does, and every row they add shifts the layout
 * under a rect that was already read. A bare `querySelector` either finds nothing yet or finds an
 * element that is about to move — so drag tests take their sources and targets from here.
 */
export async function settled<T extends Element>(find: () => T | null | undefined): Promise<T> {
  let previous = "";
  await expect
    .poll(async () => {
      const element = find();
      if (!element) return false;
      await nextFrame();
      const rect = element.getBoundingClientRect();
      const key = `${rect.left},${rect.top},${rect.width},${rect.height}`;
      const stable = rect.width > 0 && rect.height > 0 && key === previous;
      previous = key;
      return stable;
    })
    .toBe(true);
  return find()!;
}

/** `settled` for a CSS selector. */
export const settledSelector = <T extends Element = Element>(selector: string) =>
  settled(() => document.querySelector<T>(selector));
