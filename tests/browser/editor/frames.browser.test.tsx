import { expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  KEYS,
  modShift,
  openEditor,
  paintedPixels,
  selectFrame,
  session,
  type Editor,
} from "@test/editor";
import { settled } from "@test/dom";
import { holdDrag, releaseDrag } from "@test/pointer";

const RED = { r: 255, g: 0, b: 0, a: 255 };
const BLUE = { r: 0, g: 0, b: 255, a: 255 };

const frameCount = () => session().doc.frames.length;
const activeFrameIndex = () =>
  session().doc.frames.findIndex((frame) => frame.id === useEditorStore.getState().activeFrameId);

/** Paints `point` on the active frame in `color`. */
function paintOn(editor: Editor, point: { x: number; y: number }, color = RED) {
  useEditorStore.getState().setPrimaryColor(color);
  editor.click(point);
}

/** Two frames: a red pixel at (1,1) on frame 1 and a blue one at (6,6) on frame 2. */
async function twoPaintedFrames(editor: Editor) {
  paintOn(editor, { x: 1, y: 1 }, RED);
  await userEvent.click(editor.screen.getByRole("button", { name: "New frame" }));
  await selectFrame(editor, 2);
  paintOn(editor, { x: 6, y: 6 }, BLUE);
}

/** The DOM-level click a frame card's own action buttons receive (see `selectFrame`). */
function clickCardAction(frame: number, label: "Duplicate frame" | "Delete frame") {
  const card = document.querySelector(`button[aria-label="Frame ${frame}"]`)!.closest("li")!;
  (card.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement).click();
}

test("the New frame button and the N key add frames", async () => {
  const editor = await openEditor();

  await userEvent.click(editor.screen.getByRole("button", { name: "New frame" }));
  expect(frameCount()).toBe(2);
  await userEvent.keyboard("n");
  expect(frameCount()).toBe(3);
  await expect.element(editor.screen.getByRole("button", { name: "Frame 3", exact: true })).toBeVisible();

  await userEvent.keyboard(KEYS.undo);
  expect(frameCount()).toBe(2);
});

test("each frame keeps its own pixels", async () => {
  const editor = await openEditor();
  await twoPaintedFrames(editor);

  expect(paintedPixels({ frame: 0 })).toEqual(["1,1"]);
  expect(paintedPixels({ frame: 1 })).toEqual(["6,6"]);

  await selectFrame(editor, 1);
  paintOn(editor, { x: 3, y: 3 });
  expect(paintedPixels({ frame: 1 })).toEqual(["6,6"]);
});

test("the status bar tracks which frame is active", async () => {
  const editor = await openEditor();
  await twoPaintedFrames(editor);

  await expect.element(editor.screen.getByText("Frame 2/2")).toBeVisible();
  await selectFrame(editor, 1);
  await expect.element(editor.screen.getByText("Frame 1/2")).toBeVisible();
});

test("Shift+N duplicates the active frame, pixels and all, as an independent copy", async () => {
  const editor = await openEditor();
  paintOn(editor, { x: 4, y: 4 });

  await userEvent.keyboard("{Shift>}N{/Shift}");

  expect(frameCount()).toBe(2);
  expect(paintedPixels({ frame: 1 })).toEqual(["4,4"]);
  await selectFrame(editor, 2);
  paintOn(editor, { x: 9, y: 9 });
  expect(paintedPixels({ frame: 0 })).toEqual(["4,4"]);
});

test("a card's own duplicate button copies that card's frame, not the active one", async () => {
  const editor = await openEditor();
  await twoPaintedFrames(editor); // frame 2 is active

  clickCardAction(1, "Duplicate frame");

  expect(frameCount()).toBe(3);
  expect(paintedPixels({ frame: 1 })).toEqual(["1,1"]); // the copy sits right after frame 1
  expect(paintedPixels({ frame: 2 })).toEqual(["6,6"]);
});

test("a card's delete button removes that frame; undo restores it in place", async () => {
  const editor = await openEditor();
  await twoPaintedFrames(editor);

  clickCardAction(1, "Delete frame");
  expect(frameCount()).toBe(1);
  expect(paintedPixels({ frame: 0 })).toEqual(["6,6"]);

  await userEvent.keyboard(KEYS.undo);
  expect(frameCount()).toBe(2);
  expect(paintedPixels({ frame: 0 })).toEqual(["1,1"]);
  expect(paintedPixels({ frame: 1 })).toEqual(["6,6"]);
});

test("the last frame cannot be deleted", async () => {
  await openEditor();
  const deleteButton = document.querySelector('li button[aria-label="Delete frame"]') as HTMLButtonElement;

  expect(deleteButton.disabled).toBe(true);
  deleteButton.click();
  expect(frameCount()).toBe(1);
});

test(", and . step through the frames and wrap around both ends", async () => {
  const editor = await openEditor();
  await userEvent.click(editor.screen.getByRole("button", { name: "New frame" }));
  await userEvent.click(editor.screen.getByRole("button", { name: "New frame" }));
  await selectFrame(editor, 1);

  await userEvent.keyboard(".");
  expect(activeFrameIndex()).toBe(1);
  await userEvent.keyboard("..");
  expect(activeFrameIndex()).toBe(0); // wrapped past the end
  await userEvent.keyboard(",");
  expect(activeFrameIndex()).toBe(2); // wrapped past the start
  await expect.element(editor.screen.getByRole("button", { name: "Frame 3", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("Alt+, and Alt+. move the active frame along the strip", async () => {
  const editor = await openEditor();
  await twoPaintedFrames(editor);
  const [first, second] = session().doc.frames.map((frame) => frame.id);

  await selectFrame(editor, 1);
  await userEvent.keyboard("{Alt>}.{/Alt}");
  expect(session().doc.frames.map((frame) => frame.id)).toEqual([second, first]);
  expect(paintedPixels({ frame: 1 })).toEqual(["1,1"]);

  await userEvent.keyboard("{Alt>},{/Alt}");
  expect(session().doc.frames.map((frame) => frame.id)).toEqual([first, second]);
});

test("dragging a frame card past its neighbour reorders the animation", async () => {
  const editor = await openEditor();
  await twoPaintedFrames(editor);
  const [first, second] = session().doc.frames.map((frame) => frame.id);

  const cards = () => [...document.querySelectorAll('ol [data-drag-item="sortable"]')];
  const firstCard = await settled(() => cards()[0]);
  const target = (await settled(() => cards()[1])).getBoundingClientRect();
  const to = { x: target.right - 4, y: target.top + target.height / 2 };

  await holdDrag(firstCard, to);
  await releaseDrag(to);

  await expect.poll(() => session().doc.frames.map((frame) => frame.id)).toEqual([second, first]);
  await userEvent.keyboard(KEYS.undo);
  expect(session().doc.frames.map((frame) => frame.id)).toEqual([first, second]);
});

/** Alpha of the onion-skin canvas at the centre of sprite pixel `point`. */
function onionAlphaAt(point: { x: number; y: number }) {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-canvas="onion"]')!;
  const { viewport } = useEditorStore.getState();
  const ratio = canvas.width / canvas.getBoundingClientRect().width;
  const x = Math.round((viewport.originX + (point.x + 0.5) * viewport.scale) * ratio);
  const y = Math.round((viewport.originY + (point.y + 0.5) * viewport.scale) * ratio);
  return canvas.getContext("2d")!.getImageData(x, y, 1, 1).data[3];
}

test("onion skin ghosts the previous frame under the active one while it is on", async () => {
  const editor = await openEditor();
  await twoPaintedFrames(editor); // on frame 2; frame 1 has red at (1,1)
  const toggle = editor.screen.getByRole("button", { name: "Onion skin settings" });
  await expect.element(toggle).toHaveAttribute("aria-pressed", "false");
  expect(onionAlphaAt({ x: 1, y: 1 })).toBe(0);

  await userEvent.keyboard(modShift("o"));

  await expect.element(toggle).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => onionAlphaAt({ x: 1, y: 1 })).toBeGreaterThan(0);
  expect(onionAlphaAt({ x: 6, y: 6 })).toBe(0); // the active frame's own pixel is not ghosted

  await userEvent.keyboard(modShift("o"));
  await expect.poll(() => onionAlphaAt({ x: 1, y: 1 })).toBe(0);
});

test("play is disabled for a single frame, and with two it plays and pauses", async () => {
  const editor = await openEditor();
  await expect.element(editor.screen.getByRole("button", { name: "Play animation" })).toBeDisabled();

  await twoPaintedFrames(editor);
  await userEvent.click(editor.screen.getByRole("button", { name: "Play animation" }));

  await expect.element(editor.screen.getByRole("button", { name: "Pause animation" })).toBeVisible();
  expect(useEditorStore.getState().isPlaying).toBe(true);

  await userEvent.click(editor.screen.getByRole("button", { name: "Pause animation" }));
  expect(useEditorStore.getState().isPlaying).toBe(false);
});

/** The preview canvas's colour at the centre of sprite pixel `point` (16px sprite, see paint). */
function previewColorAt(point: { x: number; y: number }) {
  const canvas = document.querySelector<HTMLCanvasElement>("[aria-label='Preview'] canvas")!;
  const scale = Math.max(1, Math.floor(Math.min(canvas.width / 16, canvas.height / 16)));
  const left = Math.round((canvas.width - 16 * scale) / 2);
  const top = Math.round((canvas.height - 16 * scale) / 2);
  const data = canvas
    .getContext("2d")!
    .getImageData(left + (point.x + 0.5) * scale, top + (point.y + 0.5) * scale, 1, 1).data;
  return data[3] === 0 ? "transparent" : `rgb(${data[0]},${data[1]},${data[2]})`;
}

test("playing the animation shows every frame in turn in the preview", async () => {
  const editor = await openEditor();
  await twoPaintedFrames(editor);
  await expect.poll(() => previewColorAt({ x: 6, y: 6 })).toBe("rgb(0,0,255)"); // active frame 2

  await userEvent.click(editor.screen.getByRole("button", { name: "Play animation" }));

  // At 12 fps both frames come round within a fraction of a second.
  await expect.poll(() => previewColorAt({ x: 1, y: 1 })).toBe("rgb(255,0,0)");
  await expect.poll(() => previewColorAt({ x: 6, y: 6 })).toBe("rgb(0,0,255)");
  await userEvent.click(editor.screen.getByRole("button", { name: "Pause animation" }));
});

test("the fps slider changes the speed, and undo puts the old speed back", async () => {
  const editor = await openEditor();
  expect(session().doc.fps).toBe(12);

  const slider = editor.screen.getByRole("slider").first();
  (slider.element() as HTMLElement).focus();
  await userEvent.keyboard("{ArrowRight}{ArrowRight}");

  await expect.poll(() => session().doc.fps).toBe(14);
  await expect.element(editor.screen.getByText("14 fps")).toBeVisible();

  await userEvent.keyboard(KEYS.undo);
  expect(session().doc.fps).toBe(13);
  await userEvent.keyboard(KEYS.undo);
  expect(session().doc.fps).toBe(12);
});

test("drawing on a frame shows up in the preview straight away", async () => {
  const editor = await openEditor();

  paintOn(editor, { x: 8, y: 8 }, BLUE);

  await expect.poll(() => previewColorAt({ x: 8, y: 8 })).toBe("rgb(0,0,255)");
});
