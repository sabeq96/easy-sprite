import {
  addFrameCommand,
  duplicateFrameCommand,
  moveFrameCommand,
  removeFrameCommand,
} from "@/core/commands/frames";
import type { SpriteDocument } from "@/core/document";
import { defineCommands } from "@/editor/module";
import { useFramesStore } from "./store";

const activeFrameId = () => useFramesStore.getState().activeFrameId;

function stepFrame(doc: SpriteDocument, offset: number) {
  const index = doc.frameIndex(activeFrameId() ?? "");
  const next = (index + offset + doc.frames.length) % doc.frames.length;
  useFramesStore.getState().setActiveFrame(doc.frames[next].id);
}

/** Adding, duplicating, deleting and moving frames, and stepping the active one. */
export const FRAME_COMMANDS = defineCommands([
  {
    id: "frame.add",
    label: "New frame",
    group: "Frames",
    keys: [{ key: "n" }],
    run: ({ doc, dispatch }) => dispatch(() => addFrameCommand(doc, activeFrameId() ?? undefined)),
  },
  {
    id: "frame.duplicate",
    label: "Duplicate frame",
    group: "Frames",
    keys: [{ key: "n", shift: true }],
    run: ({ doc, dispatch }) => {
      const frameId = activeFrameId();
      if (frameId) dispatch(() => duplicateFrameCommand(doc, frameId));
    },
  },
  {
    id: "frame.delete",
    label: "Delete frame",
    group: "Frames",
    isEnabled: ({ doc }) => doc.frames.length > 1,
    run: ({ doc, dispatch }) => {
      const frameId = activeFrameId();
      if (frameId) dispatch(() => removeFrameCommand(doc, frameId));
    },
  },
  {
    id: "frame.previous",
    label: "Previous frame",
    group: "Frames",
    keys: [{ key: "," }],
    run: ({ doc }) => stepFrame(doc, -1),
  },
  {
    id: "frame.next",
    label: "Next frame",
    group: "Frames",
    keys: [{ key: "." }],
    run: ({ doc }) => stepFrame(doc, 1),
  },
  {
    id: "frame.moveLeft",
    label: "Move frame left",
    group: "Frames",
    keys: [{ key: ",", alt: true }],
    run: ({ doc, dispatch }) => {
      const index = doc.frameIndex(activeFrameId() ?? "");
      dispatch(() => moveFrameCommand(doc, index, index - 1));
    },
  },
  {
    id: "frame.moveRight",
    label: "Move frame right",
    group: "Frames",
    keys: [{ key: ".", alt: true }],
    run: ({ doc, dispatch }) => {
      const index = doc.frameIndex(activeFrameId() ?? "");
      dispatch(() => moveFrameCommand(doc, index, index + 1));
    },
  },
]);
