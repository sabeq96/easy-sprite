import { beforeEach, describe, expect, it } from "vitest";
import { useFramesStore } from "@/editor/frames/store";
import { resetEditorStores } from "@test/store";

beforeEach(() => resetEditorStores());

describe("frames store", () => {
  it("tracks the active frame", () => {
    useFramesStore.getState().setActiveFrame("f1");
    expect(useFramesStore.getState().activeFrameId).toBe("f1");
  });
});
