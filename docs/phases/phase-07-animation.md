# Phase 7 — Frames, animation preview & onion skinning

**Goal:** the timeline. Frame strip with thumbnails and drag-reorder, playback at a configurable
FPS, a live preview panel, and onion skinning with before/after counts and tinting.

**Est.** 1.5 days · **Depends on:** phase 6

---

## 7.1 Frame commands

`src/editor/commands/frames.ts` — same factory-applies-and-returns pattern.

```ts
import type { Command } from '@/editor/history';
import type { DirtyCel, SpriteDocument } from '@/editor/document';

export function addFrameCommand(doc: SpriteDocument, afterFrameId?: string): Command {
  const index = afterFrameId ? doc.frameIndex(afterFrameId) + 1 : doc.frames.length;
  const frame = doc.addFrame(index);
  return {
    label: 'Add frame',
    sizeBytes: 0,
    undo: () => { doc.removeFrame(frame.id); },
    redo: () => { doc.insertFrame(frame, index); },
  };
}

export function duplicateFrameCommand(doc: SpriteDocument, frameId: string): Command {
  const index = doc.frameIndex(frameId) + 1;
  const frame = doc.addFrame(index, frameId);      // deep-copies every layer's cel
  const cels: DirtyCel[] = doc.layers
    .map((layer) => {
      const cel = doc.getCel(layer.id, frame.id);
      return cel ? { layerId: layer.id, frameId: frame.id, pixels: new Uint8ClampedArray(cel.pixels) } : null;
    })
    .filter((cel): cel is DirtyCel => cel !== null);

  return {
    label: 'Duplicate frame',
    sizeBytes: cels.reduce((total, cel) => total + cel.pixels.length, 0),
    undo: () => { doc.removeFrame(frame.id); },
    redo: () => { doc.insertFrame(frame, index, cels); },
  };
}

export function removeFrameCommand(doc: SpriteDocument, frameId: string): Command | null {
  const removed = doc.removeFrame(frameId);        // null when it is the only frame
  if (!removed) return null;
  const { frame, index, cels } = removed;
  return {
    label: 'Delete frame',
    sizeBytes: cels.reduce((total, cel) => total + cel.pixels.length, 0),
    undo: () => { doc.insertFrame(frame, index, cels); },
    redo: () => { doc.removeFrame(frame.id); },
  };
}

export function moveFrameCommand(doc: SpriteDocument, from: number, to: number): Command | null {
  if (from === to || from < 0 || to < 0) return null;
  doc.moveFrame(from, to);
  return { label: 'Reorder frame', sizeBytes: 0, undo: () => doc.moveFrame(to, from), redo: () => doc.moveFrame(from, to) };
}

export function setFpsCommand(doc: SpriteDocument, fps: number): Command {
  const before = doc.fps;
  doc.setMeta({ fps });
  return {
    label: 'Change speed',
    sizeBytes: 0,
    undo: () => doc.setMeta({ fps: before }),
    redo: () => doc.setMeta({ fps }),
  };
}
```

## 7.2 The player

A hook that owns one rAF loop and an accumulator. Not `setInterval`: at 12 fps a timer drifts
against the display refresh and the preview stutters visibly.

`src/hooks/useAnimationPlayer.ts`

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpriteDocument } from '@/editor/document';

export interface AnimationPlayer {
  isPlaying: boolean;
  /** Index the player is on; equals the edited frame only when `followEditor` is true. */
  frameIndex: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
}

export interface AnimationPlayerOptions {
  doc: SpriteDocument;
  /** Notified on every frame advance — the preview and (optionally) the editor listen. */
  onFrame?: (frameIndex: number) => void;
  startIndex?: number;
}

export function useAnimationPlayer({ doc, onFrame, startIndex = 0 }: AnimationPlayerOptions): AnimationPlayer {
  const [isPlaying, setPlaying] = useState(false);
  const [frameIndex, setFrameIndex] = useState(startIndex);
  const indexRef = useRef(startIndex);

  useEffect(() => {
    if (!isPlaying || doc.frames.length < 2) return;

    let rafId = 0;
    let previous = performance.now();
    let accumulator = 0;

    const tick = (now: number) => {
      // Read fps every tick so the speed slider takes effect mid-playback.
      const frameDuration = 1000 / Math.max(1, doc.fps);
      accumulator += now - previous;
      previous = now;

      // Clamp so a backgrounded tab doesn't fast-forward hundreds of frames on return.
      if (accumulator > frameDuration * 4) accumulator = frameDuration;

      while (accumulator >= frameDuration) {
        accumulator -= frameDuration;
        indexRef.current = (indexRef.current + 1) % doc.frames.length;
        setFrameIndex(indexRef.current);
        onFrame?.(indexRef.current);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, doc, onFrame]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((playing) => !playing), []);

  return { isPlaying, frameIndex, play, pause, toggle };
}
```

> This is one of the few places to keep `useCallback`: `play`/`pause` are passed to keyboard
> command handlers registered in an effect, where identity decides whether the effect re-runs.

## 7.3 Preview panel

Its own small canvas driven by the player, independent of the main viewport so you can zoom the
editor without changing the preview.

`src/components/editor/PreviewPanel.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Repeat } from 'lucide-react';
import { compositeFrame } from '@/editor/composite';
import { useAnimationPlayer } from '@/hooks/useAnimationPlayer';
import { useDocumentSession } from '@/app/DocumentProvider';
import { useDocumentRevision } from '@/hooks/useDocumentRevision';
import { useCommandDispatch } from '@/hooks/useCommandDispatch';
import { setFpsCommand } from '@/editor/commands/frames';
import { MAX_FPS, MIN_FPS } from '@/constants/animation';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

export function PreviewPanel() {
  const { doc } = useDocumentSession();
  const revision = useDocumentRevision(doc, 'meta');
  const dispatch = useCommandDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scaleToFit, setScaleToFit] = useState(true);

  const player = useAnimationPlayer({ doc });

  // Paint on frame change and whenever any pixel changes (so the preview is live while drawing).
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let queued = false;
    const paint = () => {
      queued = false;
      const frame = doc.frames[player.isPlaying ? player.frameIndex : doc.frameIndex(activeFrameId)] ?? doc.frames[0];
      const source = compositeFrame(doc, frame.id);
      const scale = scaleToFit
        ? Math.max(1, Math.floor(Math.min(canvas.width / doc.width, canvas.height / doc.height)))
        : 1;

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
    return doc.events.on('pixels', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    });
  }, [doc, player.frameIndex, player.isPlaying, scaleToFit, revision]);

  return (
    <section className="flex flex-col gap-2 border-b p-2" aria-label="Preview">
      <canvas ref={canvasRef} width={240} height={180}
              className="w-full rounded border bg-[--checker-a]" />
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="ghost" aria-label={player.isPlaying ? 'Pause' : 'Play'}
                onClick={player.toggle}>
          {player.isPlaying ? <Pause /> : <Play />}
        </Button>
        <Slider
          className="flex-1"
          min={MIN_FPS} max={MAX_FPS} value={[doc.fps]}
          onValueChange={([fps]) => doc.setMeta({ fps })}          {/* live, no history */}
          onValueCommitted={([fps]) => dispatch(() => setFpsCommand(doc, fps))}
          aria-label="Frames per second"
        />
        <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{doc.fps} fps</span>
      </div>
    </section>
  );
}
```

## 7.4 Frames bar

`src/components/editor/FramesBar.tsx` — horizontal strip, one `FrameThumbnail` per frame,
drag to reorder, click to select, hover actions for duplicate/delete.

```tsx
export function FramesBar() {
  const { doc } = useDocumentSession();
  useDocumentRevision(doc, 'structure');
  const dispatch = useCommandDispatch();
  const activeFrameId = useEditorStore((state) => state.activeFrameId);
  const setActiveFrame = useEditorStore((state) => state.setActiveFrame);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <div className="flex items-center gap-2 border-t p-2">
      <ol className="flex flex-1 gap-2 overflow-x-auto">
        {doc.frames.map((frame, index) => (
          <li key={frame.id}>
            <FrameCard
              frame={frame}
              index={index}
              isActive={frame.id === activeFrameId}
              onSelect={() => setActiveFrame(frame.id)}
              onDragStart={() => setDragIndex(index)}
              onDrop={() => {
                if (dragIndex !== null) dispatch(() => moveFrameCommand(doc, dragIndex, index));
                setDragIndex(null);
              }}
              onDuplicate={() => dispatch(() => duplicateFrameCommand(doc, frame.id))}
              onDelete={() => dispatch(() => removeFrameCommand(doc, frame.id))}
              canDelete={doc.frames.length > 1}
            />
          </li>
        ))}
      </ol>
      <Button size="sm" variant="outline" onClick={() => dispatch(() => addFrameCommand(doc, activeFrameId ?? undefined))}>
        <Plus /> Frame
      </Button>
    </div>
  );
}
```

`FrameCard` shows the frame index, a composited thumbnail (same imperative-canvas pattern as
`LayerThumbnail`, but compositing all layers), and reveals its action buttons on hover/focus.
Extract the thumbnail into `src/components/editor/FrameThumbnail.tsx` so both bars share the
throttled-repaint logic via a common hook:

`src/hooks/useThumbnailCanvas.ts`

```ts
import { useEffect, type RefObject } from 'react';
import { compositeFrame, type CompositeOptions } from '@/editor/composite';
import type { SpriteDocument } from '@/editor/document';

/** Paints a frame (optionally one layer) into a canvas and repaints, throttled, on changes. */
export function useThumbnailCanvas(
  ref: RefObject<HTMLCanvasElement | null>,
  doc: SpriteDocument,
  frameId: string | null,
  options: CompositeOptions = {},
) {
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !frameId) return;

    let queued = false;
    const paint = () => {
      queued = false;
      const source = compositeFrame(doc, frameId, undefined, options);
      const scale = Math.min(canvas.width / doc.width, canvas.height / doc.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, 0, 0, doc.width * scale, doc.height * scale);
    };

    paint();
    return doc.events.on('pixels', (event) => {
      if (event.frameId !== frameId || queued) return;
      if (options.onlyLayerId && event.layerId !== options.onlyLayerId) return;
      queued = true;
      requestAnimationFrame(paint);
    });
  }, [ref, doc, frameId, options.onlyLayerId, options.includeHidden]);
}
```

## 7.5 Onion skinning

The renderer already draws the onion channel (phase 3 §3.4). This phase adds its controls and
persists the config.

`src/components/editor/OnionSkinControl.tsx`

```tsx
export function OnionSkinControl() {
  const onion = useEditorStore((state) => state.onion);
  const setOnion = useEditorStore((state) => state.setOnion);

  return (
    <Popover>
      <PopoverTrigger render={
        <Button size="icon-sm" variant={onion.enabled ? 'secondary' : 'ghost'} aria-label="Onion skin"
                aria-pressed={onion.enabled}>
          <Layers2 />
        </Button>
      } />
      <PopoverContent className="w-56 space-y-3">
        <Switch checked={onion.enabled} onCheckedChange={(enabled) => setOnion({ enabled })}>
          Onion skin
        </Switch>
        <NumberField label="Frames before" min={0} max={ONION_MAX_FRAMES}
                     value={onion.before} onChange={(before) => setOnion({ before })} />
        <NumberField label="Frames after" min={0} max={ONION_MAX_FRAMES}
                     value={onion.after} onChange={(after) => setOnion({ after })} />
        <Slider label="Opacity" min={0.1} max={0.8} step={0.05} value={[onion.opacity]}
                onValueChange={([opacity]) => setOnion({ opacity })} />
        <Switch checked={onion.tint} onCheckedChange={(tint) => setOnion({ tint })}>
          Tint red/blue
        </Switch>
      </PopoverContent>
    </Popover>
  );
}
```

Persist the config so it survives reloads — one effect, in the editor page:

```ts
// src/hooks/usePersistedViewSettings.ts
useEffect(() => { void writeSetting(SETTING_KEYS.onion, onion); }, [onion]);
useEffect(() => { void writeSetting(SETTING_KEYS.gridEnabled, gridEnabled); }, [gridEnabled]);
```

and hydrate once on mount, before the first render of the canvas, inside `DocumentProvider`.

### Onion skin rules

- Never drawn while playing — ghosts during playback are meaningless and cost a composite per
  frame. Gate on `isPlaying` in the renderer state.
- Ghost frames are **clamped, not wrapped**: at frame 0 with `before: 2` you see nothing before.
  Wrapping looks like a bug on non-looping animations.
- The current frame is never tinted; only the ghosts are.

---

## Done when

- [ ] Add/duplicate/delete/reorder frames, all undoable; the last frame cannot be deleted.
- [ ] Duplicating a frame copies every layer's pixels, and painting on the copy leaves the
      original untouched (deep copy, verified by test).
- [ ] Playback runs at the configured fps, is smooth at 1 fps and at 60 fps, and does not drift.
- [ ] Changing fps mid-playback takes effect immediately.
- [ ] Editing a frame updates the preview live while it plays.
- [ ] Onion skin shows the configured count on each side, tinted, faded by distance, clamped
      at the ends, and hidden during playback.
- [ ] Grid and onion settings survive a reload.
- [ ] A 24-frame, 4-layer, 64×64 sprite scrubs and plays without visible jank.
