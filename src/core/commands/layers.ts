import type { CelData, LayerModel, SpriteDocument } from "@/editor/document";
import type { Command } from "@/editor/history";
import { createId } from "@/lib/id";

const bytesOf = (cels: CelData[]) =>
  cels.reduce((total, cel) => total + cel.pixels.length, 0);

/**
 * Convention: a factory applies its change and returns the command. That keeps the "apply"
 * path and the "redo" path from silently diverging — the classic command-pattern bug.
 */
export function addLayerCommand(doc: SpriteDocument, aboveLayerId?: string): Command {
  const index = aboveLayerId ? doc.layerIndex(aboveLayerId) + 1 : doc.layers.length;
  const layer = doc.addLayer(undefined, index);

  return {
    label: "Add layer",
    sizeBytes: 0,
    undo: () => {
      doc.removeLayer(layer.id);
    },
    redo: () => {
      doc.insertLayer(layer, index);
    },
  };
}

export function duplicateLayerCommand(
  doc: SpriteDocument,
  layerId: string,
): Command | null {
  const source = doc.getLayer(layerId);
  if (!source) return null;

  const copy: LayerModel = { ...source, id: createId(), name: `${source.name} copy` };
  const index = doc.layerIndex(layerId) + 1;

  const cels: CelData[] = doc.frames
    .map((frame) => {
      const cel = doc.getCel(layerId, frame.id);
      return cel
        ? {
            layerId: copy.id,
            frameId: frame.id,
            pixels: new Uint8ClampedArray(cel.pixels),
          }
        : null;
    })
    .filter((cel): cel is CelData => cel !== null);

  doc.insertLayer(copy, index, cels);

  return {
    label: "Duplicate layer",
    sizeBytes: bytesOf(cels),
    undo: () => {
      doc.removeLayer(copy.id);
    },
    redo: () => {
      doc.insertLayer(copy, index, cels);
    },
  };
}

export function removeLayerCommand(doc: SpriteDocument, layerId: string): Command | null {
  // Returns null when it is the last layer — the UI disables the button, this is the backstop.
  const removed = doc.removeLayer(layerId);
  if (!removed) return null;

  const { layer, index, cels } = removed;
  return {
    label: "Delete layer",
    sizeBytes: bytesOf(cels),
    undo: () => {
      doc.insertLayer(layer, index, cels);
    },
    redo: () => {
      doc.removeLayer(layer.id);
    },
  };
}

export function reorderLayerCommand(
  doc: SpriteDocument,
  from: number,
  to: number,
): Command | null {
  if (from === to || from < 0 || to < 0 || from >= doc.layers.length) return null;
  doc.moveLayer(from, to);

  return {
    label: "Reorder layer",
    sizeBytes: 0,
    undo: () => doc.moveLayer(to, from),
    redo: () => doc.moveLayer(from, to),
  };
}

export function setLayerPropsCommand(
  doc: SpriteDocument,
  layerId: string,
  patch: Partial<Omit<LayerModel, "id">>,
  label: string,
): Command | null {
  const layer = doc.getLayer(layerId);
  if (!layer) return null;

  const before: Partial<LayerModel> = {};
  for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
    Object.assign(before, { [key]: layer[key] });
  }
  const after = { ...patch };

  doc.setLayerProps(layerId, patch);

  return {
    label,
    sizeBytes: 0,
    undo: () => doc.setLayerProps(layerId, before),
    redo: () => doc.setLayerProps(layerId, after),
  };
}

/**
 * Composites `layerId` onto the layer beneath it on every frame, then deletes it.
 * Opacity is baked in, which is why undo has to carry both layers' pixels.
 */
export function mergeLayerDownCommand(
  doc: SpriteDocument,
  layerId: string,
): Command | null {
  const index = doc.layerIndex(layerId);
  if (index <= 0) return null; // nothing beneath it

  const upper = doc.layers[index];
  const lower = doc.layers[index - 1];
  const lowerBefore: CelData[] = [];

  for (const frame of doc.frames) {
    const upperCel = doc.getCel(upper.id, frame.id);
    if (!upperCel) continue;

    const lowerCel = doc.ensureCel(lower.id, frame.id);
    lowerBefore.push({
      layerId: lower.id,
      frameId: frame.id,
      pixels: new Uint8ClampedArray(lowerCel.pixels),
    });

    blendInto(lowerCel.pixels, upperCel.pixels, upper.opacity);
    doc.markPixelsChanged(lowerCel, { x: 0, y: 0, w: doc.width, h: doc.height });
  }

  const removed = doc.removeLayer(upper.id);
  if (!removed) return null;

  const fullRect = { x: 0, y: 0, w: doc.width, h: doc.height };
  const upperCels = removed.cels;

  return {
    label: "Merge layer down",
    sizeBytes: bytesOf(lowerBefore) + bytesOf(upperCels),
    undo: () => {
      for (const snapshot of lowerBefore) {
        const cel = doc.ensureCel(snapshot.layerId, snapshot.frameId);
        cel.pixels.set(snapshot.pixels);
        doc.markPixelsChanged(cel, fullRect);
      }
      doc.insertLayer(removed.layer, removed.index, upperCels);
    },
    redo: () => {
      for (const snapshot of upperCels) {
        const lowerCel = doc.ensureCel(lower.id, snapshot.frameId);
        blendInto(lowerCel.pixels, snapshot.pixels, upper.opacity);
        doc.markPixelsChanged(lowerCel, fullRect);
      }
      doc.removeLayer(upper.id);
    },
  };
}

/** Straight-alpha source-over of `source` (scaled by `opacity`) onto `target`, in place. */
function blendInto(
  target: Uint8ClampedArray,
  source: Uint8ClampedArray,
  opacity: number,
): void {
  for (let i = 0; i < target.length; i += 4) {
    const sourceAlpha = (source[i + 3] / 255) * opacity;
    if (sourceAlpha === 0) continue;

    const destAlpha = target[i + 3] / 255;
    const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
    const mix = (channel: number) =>
      (source[i + channel] * sourceAlpha +
        target[i + channel] * destAlpha * (1 - sourceAlpha)) /
      outAlpha;

    target[i] = mix(0);
    target[i + 1] = mix(1);
    target[i + 2] = mix(2);
    target[i + 3] = outAlpha * 255;
  }
}
