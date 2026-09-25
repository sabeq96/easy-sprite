import { createElement } from "react";
import { expect } from "vitest";
import { page, userEvent } from "@vitest/browser/context";
import { AppRoutes } from "@/app/routes";
import { createSprite } from "@/db/repositories/sprites";
import { getPixel } from "@/editor/buffer";
import { compositeFrame } from "@/editor/composite";
import type { Point } from "@/editor/viewport";
import { IS_APPLE } from "@/lib/keys";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  clickSpritePixel,
  dragSpritePixels,
  hoverSpritePixel,
  type GestureOptions,
} from "@test/pointer";
import { render } from "@test/render";

/** `userEvent.keyboard` chords for the platform's command key. */
const MOD = IS_APPLE ? "Meta" : "Control";
export const mod = (key: string) => `{${MOD}>}${key}{/${MOD}}`;
export const modShift = (key: string) => `{${MOD}>}{Shift>}${key}{/Shift}{/${MOD}}`;
export const KEYS = {
  undo: mod("z"),
  redo: modShift("z"),
  selectAll: mod("a"),
  copy: mod("c"),
  cut: mod("x"),
  paste: mod("v"),
};

/**
 * A viewport big enough that a small sprite fits at a comfortable zoom: the default test tab is
 * a narrow strip that fits a 16px sprite at 0.5×, where one pointer position covers two pixels
 * and no footprint can be asserted exactly.
 */
export const EDITOR_VIEWPORT = { width: 1280, height: 720 };

/**
 * Renders the real app at a freshly created sprite and waits until the canvas is interactive —
 * the container measured and the viewport fitted to it, so sprite↔screen maths is live.
 */
export async function openEditor({ width = 16, height = 16 } = {}) {
  await page.viewport(EDITOR_VIEWPORT.width, EDITOR_VIEWPORT.height);
  const sprite = await createSprite({ width, height });
  const screen = render(createElement(AppRoutes), { route: `/sprites/${sprite.id}` });

  const canvasLocator = screen.getByRole("application", { name: "Sprite canvas" });
  await expect.element(canvasLocator).toBeVisible();
  await expect.poll(() => useEditorStore.getState().containerSize.width > 0).toBe(true);
  // The first fit can land before the layout settles; wait for a scale that makes one sprite
  // pixel at least a few screen pixels, so every aimed point hits exactly one pixel.
  await expect.poll(() => useEditorStore.getState().viewport.scale).toBeGreaterThanOrEqual(4);
  await expect.poll(() => useEditorStore.getState().activeLayerId).not.toBeNull();

  const canvas = canvasLocator.element();
  const viewport = () => useEditorStore.getState().viewport;

  return {
    screen,
    canvas,
    spriteId: sprite.id,
    /** Paints/acts at one sprite pixel through the current viewport. */
    click: (point: Point, options?: GestureOptions) =>
      clickSpritePixel(canvas, viewport(), point, options),
    /** One continuous stroke through the given sprite pixels. */
    drag: (points: Point[], options?: GestureOptions) =>
      dragSpritePixels(canvas, viewport(), points, options),
    hover: (point: Point) => hoverSpritePixel(canvas, viewport(), point),
    /** The pointer leaving the canvas, which clears hover previews. */
    leave: () =>
      canvas.dispatchEvent(new PointerEvent("pointerleave", { pointerId: 1, pointerType: "mouse" })),
  };
}

export type Editor = Awaited<ReturnType<typeof openEditor>>;

/**
 * Makes a layer active by clicking its name in the Layers panel, as a user would. Needed after
 * "New layer": adding one does not move the selection to it.
 */
export async function selectLayer(editor: Editor, name: string): Promise<void> {
  const { screen } = editor;
  await userEvent.click(screen.getByRole("button", { name, exact: true }));
  await expect
    .poll(() => session().doc.layers.find((layer) => layer.id === useEditorStore.getState().activeLayerId)?.name)
    .toBe(name);
}

/**
 * Makes frame `number` (1-based, as labelled) active by clicking its card in the frames strip.
 *
 * A DOM click rather than `userEvent.click`: Playwright's actionability check never settles on
 * the cards inside the strip's horizontal scroll area (it times out on "visible and stable" even
 * though the card's box is fixed and nothing overlays it — a forced click lands fine), so this
 * dispatches the click the button's own handler receives.
 */
export async function selectFrame(editor: Editor, number: number): Promise<void> {
  const card = editor.screen.getByRole("button", { name: `Frame ${number}`, exact: true });
  await expect.element(card).toBeVisible();
  (card.element() as HTMLElement).click();
  await expect.element(card).toHaveAttribute("aria-pressed", "true");
}

/** Chooses a tool from the sidebar and waits for it to show as pressed. */
export async function chooseTool(editor: Editor, label: string): Promise<void> {
  const button = editor.screen.getByRole("button", { name: label, exact: true });
  await userEvent.click(button);
  await expect.element(button).toHaveAttribute("aria-pressed", "true");
}

/** The live document and history, exposed by DocumentProvider in dev builds. */
export function session() {
  const handle = window.__spriteEditor;
  if (!handle) throw new Error("The editor has not loaded a document yet");
  return handle;
}

export interface CelTarget {
  /** Layer index, bottom-first like the document (defaults to the active layer). */
  layer?: number;
  /** Frame index (defaults to the active frame). */
  frame?: number;
}

function resolveCel({ layer, frame }: CelTarget) {
  const { doc } = session();
  const state = useEditorStore.getState();
  const layerId = layer === undefined ? state.activeLayerId! : doc.layers[layer].id;
  const frameId = frame === undefined ? state.activeFrameId! : doc.frames[frame].id;
  return { doc, cel: doc.getCel(layerId, frameId) };
}

/** One pixel as `#rrggbbaa` — transparent reads `#00000000` whether or not the cel exists. */
export function pixelAt(x: number, y: number, target: CelTarget = {}): string {
  const { doc, cel } = resolveCel(target);
  if (!cel) return "#00000000";
  const { r, g, b, a } = getPixel(cel.pixels, x, y, doc.width);
  if (a === 0) return "#00000000";
  return `#${[r, g, b, a].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** One pixel of the merged image (all visible layers, with opacity) as `#rrggbbaa`. */
export function compositeAt(x: number, y: number, frame?: number): string {
  const { doc } = session();
  const frameId = frame === undefined ? useEditorStore.getState().activeFrameId! : doc.frames[frame].id;
  const data = compositeFrame(doc, frameId).getContext("2d")!.getImageData(x, y, 1, 1).data;
  if (data[3] === 0) return "#00000000";
  return `#${[...data].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** Every non-transparent pixel of a cel as sorted "x,y" keys — a whole-cel shape at a glance. */
export function paintedPixels(target: CelTarget = {}): string[] {
  const { doc, cel } = resolveCel(target);
  if (!cel) return [];
  const painted: string[] = [];
  for (let y = 0; y < doc.height; y++) {
    for (let x = 0; x < doc.width; x++) {
      if (cel.pixels[(y * doc.width + x) * 4 + 3] > 0) painted.push(`${x},${y}`);
    }
  }
  return painted.sort(byPosition);
}

/** Sorted "x,y" keys for a list of points, to compare against `paintedPixels`. */
export function keys(points: Point[]): string[] {
  return [...new Set(points.map(({ x, y }) => `${x},${y}`))].sort(byPosition);
}

/** Every pixel of a `w`×`h` rectangle whose top-left is (`x`, `y`). */
export function rectPoints(x: number, y: number, w: number, h: number): Point[] {
  const points: Point[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) points.push({ x: x + dx, y: y + dy });
  return points;
}

function byPosition(a: string, b: string): number {
  const [ax, ay] = a.split(",").map(Number);
  const [bx, by] = b.split(",").map(Number);
  return ay - by || ax - bx;
}

/** The store's primary/secondary colours as `#rrggbbaa`. */
export function activeColors() {
  const { primaryColor, secondaryColor } = useEditorStore.getState();
  const hex = ({ r, g, b, a }: { r: number; g: number; b: number; a: number }) =>
    `#${[r, g, b, a].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  return { primary: hex(primaryColor), secondary: hex(secondaryColor) };
}
