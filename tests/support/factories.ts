import { vi } from "vitest";
import { SpriteDocument, type DocumentInit } from "@/core/document";
import { StrokeRecorder } from "@/core/history";
import type { Point } from "@/core/viewport";
import type { ColorSlot, Gesture, PointerModifiers, Surface, ToolHost } from "@/framework/host";
import { resolveSettings, type Settings, type StoredValues } from "@/framework/settings";
import { createSurface } from "@/hooks/toolHost/surface";
import type { RGBA } from "@/lib/color";
import { TOOL_LIST } from "@/tools";

/** A 4×4, one-layer, one-frame document — the default fixture for core tests. */
export function makeDocument(overrides: Partial<DocumentInit> = {}): SpriteDocument {
  return new SpriteDocument({
    id: "sprite-1",
    name: "Test",
    width: 4,
    height: 4,
    layers: [{ id: "l1", name: "Layer 1", opacity: 1, visible: true, locked: false }],
    frames: [{ id: "f1" }],
    cels: [],
    ...overrides,
  });
}

export const RED: RGBA = { r: 255, g: 0, b: 0, a: 255 };
export const BLUE: RGBA = { r: 0, g: 0, b: 255, a: 255 };

export const NO_MODIFIERS: PointerModifiers = { button: 0, shift: false, alt: false, ctrl: false };

/** Every registered tool's setting defaults, merged: what a tool reads from a fresh host. */
const SETTING_DEFAULTS: StoredValues = Object.fromEntries(
  TOOL_LIST.flatMap((tool) => Object.entries(resolveSettings(tool.settings, undefined))),
);

type HostOverrides = { [K in keyof ToolHost]?: Partial<ToolHost[K]> } & {
  /** Setting values over the defaults; `tool.set` writes here too. */
  settings?: StoredValues;
};

/**
 * A ToolHost of plain objects, with spies where a test may assert a call. The primary colour is
 * RED and the secondary BLUE; the document is 4×4 with nothing editable. Typed as whichever
 * tool's host the call site expects.
 */
export function fakeHost<S extends Settings = Settings>(overrides: HostOverrides = {}): ToolHost<S> {
  let settings: StoredValues = { ...SETTING_DEFAULTS, ...overrides.settings };
  const host: ToolHost = {
    colors: {
      get: (slot) => (slot === "secondary" ? BLUE : RED),
      set: vi.fn(),
      ...overrides.colors,
    },
    canvas: { setOverlay: vi.fn(), requestRender: vi.fn(), ...overrides.canvas },
    document: {
      width: 4,
      height: 4,
      sampleComposite: () => null,
      crop: () => null,
      onResize: () => () => {},
      ...overrides.document,
    },
    history: { edit: vi.fn(() => false), onUndoRedo: () => () => {}, ...overrides.history },
    tool: {
      activate: vi.fn(),
      settings: () => settings,
      set: vi.fn((key: string, value: number | boolean) => {
        settings = { ...settings, [key]: value };
      }),
      ...overrides.tool,
    },
  };
  return host as unknown as ToolHost<S>;
}

export interface GestureOptions {
  previous?: Point;
  modifiers?: PointerModifiers;
  slot?: ColorSlot;
  /** Records the surface's writes; a fresh one when omitted. */
  recorder?: StrokeRecorder;
  /** Continues a gesture on the surface its first event got. */
  surface?: Surface;
}

/** One gesture sample over a real surface on the document's first layer and frame. */
export function makeGesture(
  doc: SpriteDocument,
  point: Point,
  options: GestureOptions = {},
): Gesture {
  const recorder = options.recorder ?? new StrokeRecorder(doc, "Test");
  return {
    point,
    previous: options.previous ?? point,
    modifiers: options.modifiers ?? NO_MODIFIERS,
    slot: options.slot ?? "primary",
    surface:
      options.surface ?? createSurface(doc, doc.layers[0].id, doc.frames[0].id, recorder),
  };
}
