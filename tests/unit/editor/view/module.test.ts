import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasRenderer, Painter } from "@/core/renderer";
import { viewModule } from "@/editor/view/module";
import { useViewStore } from "@/editor/view/store";
import { makeDocument } from "@test/factories";
import { resetEditorStores } from "@test/store";

beforeEach(() => resetEditorStores());

function fakeRenderer() {
  const painters: Painter[] = [];
  const invalidate = vi.fn();
  const renderer = {
    addPainter: (painter: Painter) => {
      painters.push(painter);
      return () => painters.splice(painters.indexOf(painter), 1);
    },
    invalidate,
  } as unknown as CanvasRenderer;
  return { renderer, painters, invalidate };
}

describe("view module", () => {
  it("attachCanvas adds one painter on the overlay channel and removes it on cleanup", () => {
    const { renderer, painters } = fakeRenderer();

    const detach = viewModule.attachCanvas!(renderer, makeDocument());
    expect(painters.map((painter) => painter.channel)).toEqual(["overlay"]);

    detach();
    expect(painters).toEqual([]);
  });

  it("repaints the overlay channel when the grid toggles or resizes, until detached", () => {
    const { renderer, invalidate } = fakeRenderer();
    const detach = viewModule.attachCanvas!(renderer, makeDocument());

    useViewStore.getState().toggleGrid();
    useViewStore.getState().setGridSize(4);
    useViewStore.getState().setCheckerSize(2);
    expect(invalidate.mock.calls).toEqual([["overlay"], ["overlay"]]);

    detach();
    useViewStore.getState().toggleGrid();
    expect(invalidate).toHaveBeenCalledTimes(2);
  });
});
