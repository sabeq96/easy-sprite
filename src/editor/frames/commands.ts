import type { CommandRegistry } from "@/commands/types";
import {
  addFrameCommand,
  duplicateFrameCommand,
  moveFrameCommand,
  removeFrameCommand,
} from "@/core/commands/frames";
import type { ModuleContext } from "@/editor/module";
import { useFramesStore } from "./store";

/** Adding, duplicating, deleting and moving frames, and stepping the active one. */
export function frameCommands({ doc, dispatch }: ModuleContext): CommandRegistry {
  const activeFrameId = () => useFramesStore.getState().activeFrameId;

  const stepFrame = (offset: number) => {
    const index = doc.frameIndex(activeFrameId() ?? "");
    const next = (index + offset + doc.frames.length) % doc.frames.length;
    useFramesStore.getState().setActiveFrame(doc.frames[next].id);
  };

  return {
    "frame.add": {
      id: "frame.add",
      label: "New frame",
      group: "Frames",
      run: () => dispatch(() => addFrameCommand(doc, activeFrameId() ?? undefined)),
    },
    "frame.duplicate": {
      id: "frame.duplicate",
      label: "Duplicate frame",
      group: "Frames",
      run: () => {
        const frameId = activeFrameId();
        if (frameId) dispatch(() => duplicateFrameCommand(doc, frameId));
      },
    },
    "frame.delete": {
      id: "frame.delete",
      label: "Delete frame",
      group: "Frames",
      isEnabled: () => doc.frames.length > 1,
      run: () => {
        const frameId = activeFrameId();
        if (frameId) dispatch(() => removeFrameCommand(doc, frameId));
      },
    },
    "frame.previous": {
      id: "frame.previous",
      label: "Previous frame",
      group: "Frames",
      run: () => stepFrame(-1),
    },
    "frame.next": {
      id: "frame.next",
      label: "Next frame",
      group: "Frames",
      run: () => stepFrame(1),
    },
    "frame.moveLeft": {
      id: "frame.moveLeft",
      label: "Move frame left",
      group: "Frames",
      run: () => {
        const index = doc.frameIndex(activeFrameId() ?? "");
        dispatch(() => moveFrameCommand(doc, index, index - 1));
      },
    },
    "frame.moveRight": {
      id: "frame.moveRight",
      label: "Move frame right",
      group: "Frames",
      run: () => {
        const index = doc.frameIndex(activeFrameId() ?? "");
        dispatch(() => moveFrameCommand(doc, index, index + 1));
      },
    },
  };
}
