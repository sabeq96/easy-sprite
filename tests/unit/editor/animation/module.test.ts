import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasRenderer, Painter } from "@/core/renderer";
import { animationModule } from "@/editor/animation/module";
import { useAnimationStore } from "@/editor/animation/store";
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

describe("animation module", () => {
  it("attachCanvas adds one painter on the onion channel and removes it on cleanup", () => {
    const { renderer, painters } = fakeRenderer();

    const detach = animationModule.attachCanvas!(renderer, makeDocument());
    expect(painters.map((painter) => painter.channel)).toEqual(["onion"]);

    detach();
    expect(painters).toEqual([]);
  });

  it("repaints the onion channel when the onion config changes, until detached", () => {
    const { renderer, invalidate } = fakeRenderer();
    const detach = animationModule.attachCanvas!(renderer, makeDocument());

    useAnimationStore.getState().setOnion({ enabled: true });
    expect(invalidate).toHaveBeenCalledExactlyOnceWith("onion");

    detach();
    useAnimationStore.getState().setOnion({ opacity: 0.5 });
    expect(invalidate).toHaveBeenCalledOnce();
  });
});
