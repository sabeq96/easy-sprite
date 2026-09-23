import { SpriteDocument, type DocumentInit } from "@/editor/document";
import { StrokeRecorder } from "@/editor/history";
import type { ToolContext } from "@/editor/tools/types";
import type { RGBA } from "@/lib/color";

/** A 4×4, one-layer, one-frame document — the default fixture for core tests. */
export function makeDocument(overrides: Partial<DocumentInit> = {}): SpriteDocument {
  return new SpriteDocument({
    id: "sprite-1",
    name: "Test",
    width: 4,
    height: 4,
    fps: 12,
    layers: [{ id: "l1", name: "Layer 1", opacity: 1, visible: true, locked: false }],
    frames: [{ id: "f1" }],
    cels: [],
    ...overrides,
  });
}

export const RED: RGBA = { r: 255, g: 0, b: 0, a: 255 };
export const BLUE: RGBA = { r: 0, g: 0, b: 255, a: 255 };

export interface ToolContextFixture {
  ctx: ToolContext;
  stroke: StrokeRecorder;
  picked: { color: RGBA | null };
}

/** Builds a ToolContext over a real document, with stubs for the UI-facing callbacks. */
export function makeToolContext(
  doc: SpriteDocument,
  overrides: Partial<ToolContext> = {},
): ToolContextFixture {
  const stroke = new StrokeRecorder(doc, "Test");
  const picked: { color: RGBA | null } = { color: null };

  const ctx: ToolContext = {
    doc,
    layerId: doc.layers[0].id,
    frameId: doc.frames[0].id,
    color: RED,
    options: {
      brushSize: 1,
      mirrorHorizontal: false,
      mirrorVertical: false,
      pickFromComposite: false,
    },
    stroke,
    setColor: (color) => {
      picked.color = color;
    },
    setOverlay: () => {},
    ...overrides,
  };

  return { ctx, stroke, picked };
}
