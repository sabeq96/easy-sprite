import { SpriteDocument, type DocumentInit } from "@/editor/document";

/** A 4x4, one-layer, one-frame document — the default fixture for core tests. */
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

export const RED = { r: 255, g: 0, b: 0, a: 255 };
export const BLUE = { r: 0, g: 0, b: 255, a: 255 };
