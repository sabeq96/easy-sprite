import { beforeEach, describe, expect, it } from "vitest";
import { useAnimationStore } from "@/editor/animation/store";
import { resetEditorStores } from "@test/store";

beforeEach(() => resetEditorStores());

describe("animation store", () => {
  it("setOnion merges a partial patch onto the existing config", () => {
    useAnimationStore.getState().setOnion({ enabled: true });
    expect(useAnimationStore.getState().onion.enabled).toBe(true);
    expect(useAnimationStore.getState().onion.direction).toBe("before"); // untouched fields survive the patch
  });

  it("tracks playback", () => {
    useAnimationStore.getState().setPlaying(true);
    expect(useAnimationStore.getState().isPlaying).toBe(true);
  });
});
