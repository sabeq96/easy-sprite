import type { CelData, SpriteDocument } from "@/editor/document";
import type { Command } from "@/editor/history";

const bytesOf = (cels: CelData[]) =>
  cels.reduce((total, cel) => total + cel.pixels.length, 0);

export function addFrameCommand(doc: SpriteDocument, afterFrameId?: string): Command {
  const index = afterFrameId ? doc.frameIndex(afterFrameId) + 1 : doc.frames.length;
  const frame = doc.addFrame(index);

  return {
    label: "Add frame",
    sizeBytes: 0,
    undo: () => {
      doc.removeFrame(frame.id);
    },
    redo: () => {
      doc.insertFrame(frame, index);
    },
  };
}

export function duplicateFrameCommand(doc: SpriteDocument, frameId: string): Command {
  const index = doc.frameIndex(frameId) + 1;
  // addFrame deep-copies every layer's cel for the source frame.
  const frame = doc.addFrame(index, frameId);

  const cels: CelData[] = doc.layers
    .map((layer) => {
      const cel = doc.getCel(layer.id, frame.id);
      return cel
        ? { layerId: layer.id, frameId: frame.id, pixels: new Uint8ClampedArray(cel.pixels) }
        : null;
    })
    .filter((cel): cel is CelData => cel !== null);

  return {
    label: "Duplicate frame",
    sizeBytes: bytesOf(cels),
    undo: () => {
      doc.removeFrame(frame.id);
    },
    redo: () => {
      doc.insertFrame(frame, index, cels);
    },
  };
}

export function removeFrameCommand(doc: SpriteDocument, frameId: string): Command | null {
  // Null when it is the only frame.
  const removed = doc.removeFrame(frameId);
  if (!removed) return null;

  const { frame, index, cels } = removed;
  return {
    label: "Delete frame",
    sizeBytes: bytesOf(cels),
    undo: () => {
      doc.insertFrame(frame, index, cels);
    },
    redo: () => {
      doc.removeFrame(frame.id);
    },
  };
}

export function moveFrameCommand(
  doc: SpriteDocument,
  from: number,
  to: number,
): Command | null {
  if (from === to || from < 0 || to < 0 || from >= doc.frames.length) return null;
  doc.moveFrame(from, to);

  return {
    label: "Reorder frame",
    sizeBytes: 0,
    undo: () => doc.moveFrame(to, from),
    redo: () => doc.moveFrame(from, to),
  };
}

export function setFpsCommand(doc: SpriteDocument, fps: number): Command | null {
  const before = doc.fps;
  if (before === fps) return null;
  doc.setMeta({ fps });

  return {
    label: "Change speed",
    sizeBytes: 0,
    undo: () => doc.setMeta({ fps: before }),
    redo: () => doc.setMeta({ fps }),
  };
}
