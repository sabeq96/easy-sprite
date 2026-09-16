# Phase 6 — Layers

**Goal:** the layers panel and every layer operation, each one undoable: add, delete, duplicate,
rename, reorder (drag), visibility, lock, opacity, merge down, plus per-layer thumbnails.

**Est.** 1 day · **Depends on:** phases 2 and 3

---

## 6.1 Commands

Phase 2 established the pattern: **the factory applies the change and returns the command.**
Complete the set in `src/editor/commands/layers.ts`.

```ts
import { createId } from '@/lib/id';
import { createBuffer } from '@/editor/buffer';
import type { Command } from '@/editor/history';
import type { DirtyCel, LayerModel, SpriteDocument } from '@/editor/document';

export function addLayerCommand(doc: SpriteDocument, aboveLayerId?: string): Command {
  const index = aboveLayerId ? doc.layerIndex(aboveLayerId) + 1 : doc.layers.length;
  const layer = doc.addLayer(undefined, index);
  return {
    label: 'Add layer',
    sizeBytes: 0,
    undo: () => { doc.removeLayer(layer.id); },
    redo: () => { doc.insertLayer(layer, index); },
  };
}

export function duplicateLayerCommand(doc: SpriteDocument, layerId: string): Command | null {
  const source = doc.layers.find((layer) => layer.id === layerId);
  if (!source) return null;

  const copy: LayerModel = { ...source, id: createId(), name: `${source.name} copy` };
  const index = doc.layerIndex(layerId) + 1;
  const cels: DirtyCel[] = doc.frames
    .map((frame) => {
      const cel = doc.getCel(layerId, frame.id);
      return cel ? { layerId: copy.id, frameId: frame.id, pixels: new Uint8ClampedArray(cel.pixels) } : null;
    })
    .filter((cel): cel is DirtyCel => cel !== null);

  doc.insertLayer(copy, index, cels);
  return {
    label: 'Duplicate layer',
    sizeBytes: cels.reduce((total, cel) => total + cel.pixels.length, 0),
    undo: () => { doc.removeLayer(copy.id); },
    redo: () => { doc.insertLayer(copy, index, cels); },
  };
}

export function removeLayerCommand(doc: SpriteDocument, layerId: string): Command | null {
  const removed = doc.removeLayer(layerId);          // returns null when it's the last layer
  if (!removed) return null;
  const { layer, index, cels } = removed;
  return {
    label: 'Delete layer',
    sizeBytes: cels.reduce((total, cel) => total + cel.pixels.length, 0),
    undo: () => { doc.insertLayer(layer, index, cels); },
    redo: () => { doc.removeLayer(layer.id); },
  };
}

export function reorderLayerCommand(doc: SpriteDocument, from: number, to: number): Command | null {
  if (from === to) return null;
  doc.moveLayer(from, to);
  return {
    label: 'Reorder layer',
    sizeBytes: 0,
    undo: () => doc.moveLayer(to, from),
    redo: () => doc.moveLayer(from, to),
  };
}

export function setLayerPropsCommand(
  doc: SpriteDocument, layerId: string, patch: Partial<Omit<LayerModel, 'id'>>, label: string,
): Command | null {
  const layer = doc.layers.find((candidate) => candidate.id === layerId);
  if (!layer) return null;

  const before = { ...layer };
  const after = { ...before, ...patch };
  doc.setLayerProps(layerId, patch);

  return {
    label,
    sizeBytes: 0,
    undo: () => doc.setLayerProps(layerId, before),
    redo: () => doc.setLayerProps(layerId, after),
  };
}

/**
 * Merge down: composite `layerId` onto the layer beneath it, on every frame, then delete it.
 * Opacity is baked in, which is why the undo payload is both layers' pixels.
 */
export function mergeLayerDownCommand(doc: SpriteDocument, layerId: string): Command | null {
  const index = doc.layerIndex(layerId);
  if (index <= 0) return null;                        // nothing beneath it

  const upper = doc.layers[index];
  const lower = doc.layers[index - 1];
  const before: DirtyCel[] = [];

  for (const frame of doc.frames) {
    const upperCel = doc.getCel(upper.id, frame.id);
    if (!upperCel) continue;

    const lowerCel = doc.ensureCel(lower.id, frame.id);
    before.push({ layerId: lower.id, frameId: frame.id, pixels: new Uint8ClampedArray(lowerCel.pixels) });
    blendInto(lowerCel.pixels, upperCel.pixels, upper.opacity);
    doc.markPixelsChanged(lowerCel, { x: 0, y: 0, w: doc.width, h: doc.height });
  }

  const removed = doc.removeLayer(upper.id)!;
  return {
    label: 'Merge layer down',
    sizeBytes: before.reduce((total, cel) => total + cel.pixels.length, 0) * 2,
    undo: () => {
      for (const snapshot of before) {
        const cel = doc.ensureCel(snapshot.layerId, snapshot.frameId);
        cel.pixels.set(snapshot.pixels);
        doc.markPixelsChanged(cel, { x: 0, y: 0, w: doc.width, h: doc.height });
      }
      doc.insertLayer(removed.layer, removed.index, removed.cels);
    },
    redo: () => { mergeLayerDownCommand(doc, upper.id); },
  };
}

/** Straight-alpha source-over of `source` (scaled by `opacity`) onto `target`, in place. */
function blendInto(target: Uint8ClampedArray, source: Uint8ClampedArray, opacity: number): void {
  for (let i = 0; i < target.length; i += 4) {
    const sa = (source[i + 3] / 255) * opacity;
    if (sa === 0) continue;
    const da = target[i + 3] / 255;
    const outA = sa + da * (1 - sa);
    target[i]     = (source[i]     * sa + target[i]     * da * (1 - sa)) / outA;
    target[i + 1] = (source[i + 1] * sa + target[i + 1] * da * (1 - sa)) / outA;
    target[i + 2] = (source[i + 2] * sa + target[i + 2] * da * (1 - sa)) / outA;
    target[i + 3] = outA * 255;
  }
}

export { createBuffer };
```

`src/editor/commands/layers.test.ts` — merge down must be visually identical to the compositor's
output for the same two layers; that is the test that catches blending mistakes:

```ts
it('merge down matches the compositor', () => {
  // paint semi-transparent red over opaque blue on both paths, compare buffers byte for byte
});
```

## 6.2 A command-dispatch hook

Panels should not each re-implement "apply command, push to history, ignore null". One hook:

`src/hooks/useCommandDispatch.ts`

```ts
import { useDocumentSession } from '@/app/DocumentProvider';
import type { Command } from '@/editor/history';

/**
 * Runs a command factory (which applies its own change) and records it for undo.
 * Factories return null when the operation is a no-op, and callers can ignore that.
 */
export function useCommandDispatch() {
  const { history } = useDocumentSession();
  return (factory: () => Command | null) => {
    const command = factory();
    if (command) history.push(command);
    return command !== null;
  };
}
```

Usage stays a one-liner at every call site:

```ts
const dispatch = useCommandDispatch();
dispatch(() => removeLayerCommand(doc, layer.id));
```

## 6.3 Layer thumbnails

Small, throttled, and off the React render path — a `<canvas>` the component paints imperatively.

`src/components/editor/LayerThumbnail.tsx`

```tsx
import { useEffect, useRef } from 'react';
import { compositeFrame } from '@/editor/composite';
import { useDocumentSession } from '@/app/DocumentProvider';
import { LAYER_THUMB_PX } from '@/constants/canvas';

export function LayerThumbnail({ layerId, frameId }: { layerId: string; frameId: string }) {
  const { doc } = useDocumentSession();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let queued = false;
    const paint = () => {
      queued = false;
      const source = compositeFrame(doc, frameId, undefined, { onlyLayerId: layerId, includeHidden: true });
      const scale = Math.min(canvas.width / doc.width, canvas.height / doc.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        source,
        Math.round((canvas.width - doc.width * scale) / 2),
        Math.round((canvas.height - doc.height * scale) / 2),
        doc.width * scale, doc.height * scale,
      );
    };

    paint();
    // Repaint at most once per animation frame, only for this layer/frame pair.
    return doc.events.on('pixels', (event) => {
      if (event.layerId !== layerId || event.frameId !== frameId || queued) return;
      queued = true;
      requestAnimationFrame(paint);
    });
  }, [doc, layerId, frameId]);

  return (
    <canvas
      ref={ref}
      width={LAYER_THUMB_PX}
      height={LAYER_THUMB_PX}
      className="size-8 rounded border bg-[--checker-a]"
    />
  );
}
```

## 6.4 Panel UI

`src/components/editor/LayersPanel.tsx` — list + toolbar. It subscribes to the document's
`structure` and `meta` revisions, which is the only reason it re-renders.

```tsx
import { Copy, Eye, EyeOff, Layers, Lock, LockOpen, Plus, Trash2, ChevronsDownUp } from 'lucide-react';
import { useDocumentSession } from '@/app/DocumentProvider';
import { useDocumentRevision } from '@/hooks/useDocumentRevision';
import { useCommandDispatch } from '@/hooks/useCommandDispatch';
import { useEditorStore } from '@/stores/useEditorStore';
import { LayerRow } from '@/components/editor/LayerRow';
import { Button } from '@/components/ui/button';
import {
  addLayerCommand, duplicateLayerCommand, mergeLayerDownCommand, removeLayerCommand,
} from '@/editor/commands/layers';

export function LayersPanel() {
  const { doc } = useDocumentSession();
  useDocumentRevision(doc, 'structure');
  useDocumentRevision(doc, 'meta');

  const dispatch = useCommandDispatch();
  const activeLayerId = useEditorStore((state) => state.activeLayerId);
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);

  return (
    <section className="flex min-h-0 flex-col" aria-label="Layers">
      <header className="flex h-8 items-center gap-1 border-b px-2 text-xs font-medium text-muted-foreground">
        <Layers className="size-3.5" /> Layers
        <div className="ml-auto flex gap-0.5">
          <Button size="icon-xs" variant="ghost" aria-label="Add layer"
                  onClick={() => dispatch(() => addLayerCommand(doc, activeLayerId ?? undefined))}>
            <Plus />
          </Button>
          <Button size="icon-xs" variant="ghost" aria-label="Duplicate layer"
                  disabled={!activeLayerId}
                  onClick={() => activeLayerId && dispatch(() => duplicateLayerCommand(doc, activeLayerId))}>
            <Copy />
          </Button>
          <Button size="icon-xs" variant="ghost" aria-label="Merge down"
                  disabled={!activeLayerId || doc.layerIndex(activeLayerId) === 0}
                  onClick={() => activeLayerId && dispatch(() => mergeLayerDownCommand(doc, activeLayerId))}>
            <ChevronsDownUp />
          </Button>
          <Button size="icon-xs" variant="ghost" aria-label="Delete layer"
                  disabled={doc.layers.length === 1}
                  onClick={() => activeLayerId && dispatch(() => removeLayerCommand(doc, activeLayerId))}>
            <Trash2 />
          </Button>
        </div>
      </header>

      {/* Rendered top-first: the topmost layer is the last in the array. */}
      <ul className="flex-1 overflow-y-auto">
        {[...doc.layers].reverse().map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            isActive={layer.id === activeLayerId}
            onSelect={() => setActiveLayer(layer.id)}
          />
        ))}
      </ul>
    </section>
  );
}
```

`src/components/editor/LayerRow.tsx` holds one row: thumbnail, inline-rename input, visibility and
lock toggles, opacity slider in a popover, and the drag handle. Keep it under 150 lines by
extracting `LayerRowMenu` and `LayerOpacityControl`.

```tsx
export function LayerRow({ layer, isActive, onSelect }: LayerRowProps) {
  const { doc } = useDocumentSession();
  const dispatch = useCommandDispatch();
  const frameId = useEditorStore((state) => state.activeFrameId);
  const [isRenaming, setRenaming] = useState(false);

  const toggle = (patch: Partial<LayerModel>, label: string) =>
    dispatch(() => setLayerPropsCommand(doc, layer.id, patch, label));

  return (
    <li
      data-active={isActive || undefined}
      className="group flex items-center gap-2 border-b px-2 py-1.5 data-active:bg-muted"
      onClick={onSelect}
      draggable
      onDragStart={(event) => event.dataTransfer.setData('text/layer-id', layer.id)}
      onDrop={(event) => {
        const sourceId = event.dataTransfer.getData('text/layer-id');
        dispatch(() => reorderLayerCommand(doc, doc.layerIndex(sourceId), doc.layerIndex(layer.id)));
      }}
      onDragOver={(event) => event.preventDefault()}
    >
      <Button size="icon-xs" variant="ghost" aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
              onClick={() => toggle({ visible: !layer.visible }, 'Toggle layer visibility')}>
        {layer.visible ? <Eye /> : <EyeOff className="opacity-40" />}
      </Button>

      {frameId && <LayerThumbnail layerId={layer.id} frameId={frameId} />}

      {isRenaming ? (
        <LayerNameInput layer={layer} onDone={() => setRenaming(false)} />
      ) : (
        <span className="flex-1 truncate text-sm" onDoubleClick={() => setRenaming(true)}>
          {layer.name}
        </span>
      )}

      <LayerOpacityControl layer={layer} />
      <Button size="icon-xs" variant="ghost" aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
              onClick={() => toggle({ locked: !layer.locked }, 'Toggle layer lock')}>
        {layer.locked ? <Lock /> : <LockOpen className="opacity-40 group-hover:opacity-100" />}
      </Button>
    </li>
  );
}
```

Two UI details that matter more than they look:

- **Opacity drags must not spam history.** The slider updates the document live
  (`doc.setLayerProps`) and pushes a single `setLayerPropsCommand` on release
  (`onValueCommitted` in the shadcn slider). Same rule applies to any future continuous control.
- **Renaming commits on blur and on Enter, cancels on Escape**, and the input stops keydown
  propagation so the global shortcuts don't fire while typing.

## 6.5 Active layer invariants

Owned by one hook, `src/hooks/useActiveTargets.ts`, so no panel has to guard for stale ids:

```ts
export function useActiveTargets() {
  const { doc } = useDocumentSession();
  const revision = useDocumentRevision(doc, 'structure');
  const { activeLayerId, activeFrameId, setActiveLayer, setActiveFrame } = useEditorStore(...);

  useEffect(() => {
    // After a delete, fall back to the topmost layer / first frame rather than rendering nothing.
    if (!activeLayerId || !doc.layers.some((layer) => layer.id === activeLayerId)) {
      setActiveLayer(doc.layers.at(-1)!.id);
    }
    if (!activeFrameId || !doc.frames.some((frame) => frame.id === activeFrameId)) {
      setActiveFrame(doc.frames[0].id);
    }
  }, [revision, doc, activeLayerId, activeFrameId, setActiveLayer, setActiveFrame]);

  return { layerId: activeLayerId, frameId: activeFrameId };
}
```

---

## Done when

- [ ] Add/duplicate/delete/reorder/merge all work and all undo to the exact prior state.
- [ ] The last layer cannot be deleted (button disabled, command returns null).
- [ ] Hidden layers disappear from the canvas but keep their pixels and thumbnail.
- [ ] Locked layers reject drawing; the row shows the lock state clearly.
- [ ] Opacity drag is smooth (live canvas update) and produces exactly one undo entry.
- [ ] Merge down is pixel-identical to what the compositor showed before the merge.
- [ ] Drag-reordering a layer updates z-order immediately and persists after reload.
