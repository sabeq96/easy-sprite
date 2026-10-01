import { beforeEach, describe, expect, it } from "vitest";
import { useLayersStore } from "@/editor/layers/store";
import { resetEditorStores } from "@test/store";

beforeEach(() => resetEditorStores());

describe("layers store", () => {
  it("tracks the active layer", () => {
    useLayersStore.getState().setActiveLayer("l1");
    expect(useLayersStore.getState().activeLayerId).toBe("l1");
  });
});
