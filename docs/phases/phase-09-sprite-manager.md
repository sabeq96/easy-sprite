# Phase 9 — Sprite manager & canvas settings

**Goal:** the library. A gallery of every sprite with thumbnails, search, tags, sort, rename,
duplicate, delete; a "new sprite" dialog with size presets; and canvas resize/crop for an open
sprite.

**Est.** 1 day · **Depends on:** phase 1

---

## 9.1 Gallery

`useLiveQuery` makes this reactive with no cache layer: any repository write anywhere in the app
updates the grid.

`src/hooks/useSpriteLibrary.ts`

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '@/db/db';
import type { SpriteRecord } from '@/db/schema';

export type SpriteSort = 'updated' | 'created' | 'name';

export interface SpriteLibrary {
  sprites: SpriteRecord[];
  isLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  sort: SpriteSort;
  setSort: (value: SpriteSort) => void;
  tag: string | null;
  setTag: (value: string | null) => void;
  allTags: string[];
}

export function useSpriteLibrary(): SpriteLibrary {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SpriteSort>('updated');
  const [tag, setTag] = useState<string | null>(null);

  // Dexie re-runs this whenever any row it read changes; deps behave like useEffect deps.
  const sprites = useLiveQuery(async () => {
    const rows = tag
      ? await db.sprites.where('tags').equals(tag).toArray()
      : await db.sprites.toArray();

    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((sprite) => sprite.name.toLowerCase().includes(needle))
      : rows;

    return filtered.sort(comparators[sort]);
  }, [search, sort, tag]);

  const allTags = useLiveQuery(async () => {
    const rows = await db.sprites.toArray();
    return [...new Set(rows.flatMap((sprite) => sprite.tags))].sort();
  }, [], []);

  return {
    sprites: sprites ?? [],
    isLoading: sprites === undefined,
    search, setSearch, sort, setSort, tag, setTag, allTags,
  };
}

const comparators: Record<SpriteSort, (a: SpriteRecord, b: SpriteRecord) => number> = {
  updated: (a, b) => b.updatedAt - a.updatedAt,
  created: (a, b) => b.createdAt - a.createdAt,
  name: (a, b) => a.name.localeCompare(b.name),
};
```

> `useLiveQuery` returns `undefined` on the first render — that is the loading state, and it is
> why `isLoading` is exposed rather than defaulting to `[]` silently. An empty gallery and a
> loading gallery must not look the same.

`src/components/manager/SpriteManagerPage.tsx`

```tsx
export function SpriteManagerPage() {
  const library = useSpriteLibrary();
  const [isCreating, setCreating] = useState(false);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <SpriteLibraryToolbar library={library} onCreate={() => setCreating(true)} />

      {library.isLoading ? (
        <SpriteGridSkeleton />
      ) : library.sprites.length === 0 ? (
        <EmptyState
          title={library.search ? 'No sprites match' : 'No sprites yet'}
          action={<Button onClick={() => setCreating(true)}><Plus /> New sprite</Button>}
        />
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
          {library.sprites.map((sprite) => (
            <li key={sprite.id}><SpriteCard sprite={sprite} /></li>
          ))}
        </ul>
      )}

      <NewSpriteDialog open={isCreating} onOpenChange={setCreating} />
    </div>
  );
}
```

## 9.2 Thumbnails in the grid

Thumbnails are stored as `Blob`s (phase 2 §2.6). Object URLs must be revoked or the tab leaks
memory as the user scrolls — one hook makes that impossible to forget:

`src/hooks/useBlobUrl.ts`

```ts
import { useEffect, useState } from 'react';

export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) { setUrl(null); return; }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return url;
}
```

`src/components/manager/SpriteCard.tsx`

```tsx
export function SpriteCard({ sprite }: { sprite: SpriteRecord }) {
  const navigate = useNavigate();
  const thumbnailUrl = useBlobUrl(sprite.thumbnail);

  return (
    <article className="group overflow-hidden rounded-xl border bg-card transition-colors hover:border-ring">
      <button
        type="button"
        className="block w-full bg-[--checker-a] p-4"
        onClick={() => navigate(ROUTES.sprite(sprite.id))}
        aria-label={`Open ${sprite.name}`}
      >
        {thumbnailUrl ? (
          // image-rendering:pixelated is mandatory — a blurry pixel-art thumbnail looks broken.
          <img src={thumbnailUrl} alt="" className="mx-auto h-24 object-contain [image-rendering:pixelated]" />
        ) : (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">Empty</div>
        )}
      </button>

      <div className="flex items-center gap-1 border-t px-2 py-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{sprite.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {sprite.width}×{sprite.height} · {sprite.frames.length} {sprite.frames.length === 1 ? 'frame' : 'frames'}
          </p>
        </div>
        <SpriteCardMenu sprite={sprite} />
      </div>
    </article>
  );
}
```

`SpriteCardMenu` (dropdown): Open, Rename, Duplicate, Edit tags, Export spritesheet (phase 10),
Delete. Delete goes through a confirm dialog — this is the one destructive action in the app and
there is no trash:

```tsx
<ConfirmDialog
  title={`Delete "${sprite.name}"?`}
  description="This permanently deletes the sprite and all its frames. Export a backup first if you might want it back."
  confirmLabel="Delete"
  variant="destructive"
  onConfirm={() => removeSprite(sprite.id)}
/>
```

## 9.3 New sprite dialog

```tsx
export function NewSpriteDialog({ open, onOpenChange }: NewSpriteDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [size, setSize] = useState({ width: DEFAULT_CANVAS_SIZE, height: DEFAULT_CANVAS_SIZE });
  const [linked, setLinked] = useState(true);      // keep it square by default

  const create = async () => {
    const sprite = await createSprite({ name, ...size });
    onOpenChange(false);
    navigate(ROUTES.sprite(sprite.id));            // straight into the editor
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>New sprite</DialogTitle>

        <Label>Name<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Untitled" autoFocus /></Label>

        <div className="flex flex-wrap gap-1">
          {CANVAS_SIZE_PRESETS.map((preset) => (
            <Button key={preset} size="xs" variant="outline"
                    onClick={() => setSize({ width: preset, height: preset })}>
              {preset}×{preset}
            </Button>
          ))}
        </div>

        <SizeFields size={size} linked={linked} onLinkedChange={setLinked} onChange={setSize} />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={create} disabled={!isValidSize(size)}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

`isValidSize` lives in `src/lib/validation.ts` alongside the other guards
(`MIN_CANVAS_SIZE`–`MAX_CANVAS_SIZE`, integers, and the `SPRITE_SIZE_WARN_BYTES` check that shows
a warning rather than blocking).

## 9.4 Canvas resize

Resizing touches every cel, so it is a document command with a full-buffer undo payload. It is
also where the "crop vs pad" anchor matters.

`src/editor/commands/canvas.ts`

```ts
import type { Command } from '@/editor/history';
import type { DirtyCel, SpriteDocument } from '@/editor/document';
import type { ResizeOptions } from '@/editor/buffer';

export function resizeCanvasCommand(
  doc: SpriteDocument, width: number, height: number, options: ResizeOptions = {},
): Command | null {
  if (width === doc.width && height === doc.height) return null;

  const before = { width: doc.width, height: doc.height };
  // Full snapshot: shrinking discards pixels, so nothing smaller is sufficient for undo.
  const snapshots: DirtyCel[] = [];
  for (const layer of doc.layers) {
    for (const frame of doc.frames) {
      const cel = doc.getCel(layer.id, frame.id);
      if (cel) snapshots.push({ layerId: layer.id, frameId: frame.id, pixels: new Uint8ClampedArray(cel.pixels) });
    }
  }

  doc.resize(width, height, options);

  return {
    label: 'Resize canvas',
    sizeBytes: snapshots.reduce((total, cel) => total + cel.pixels.length, 0),
    undo: () => {
      doc.resize(before.width, before.height, options);
      for (const snapshot of snapshots) {
        const cel = doc.ensureCel(snapshot.layerId, snapshot.frameId);
        cel.pixels.set(snapshot.pixels);
        doc.markPixelsChanged(cel, { x: 0, y: 0, w: before.width, h: before.height });
      }
    },
    redo: () => { doc.resize(width, height, options); },
  };
}
```

The dialog offers a 3×3 anchor grid (the standard "which corner do I keep" control), a live
before/after size readout, and a warning when the new size would discard pixels:

```tsx
const willCrop = width < doc.width || height < doc.height;
{willCrop && <Alert variant="warning">Pixels outside the new canvas will be deleted. This can be undone.</Alert>}
```

> **Scope note:** this resizes the *canvas* (crop/pad). Scaling the *artwork* (nearest-neighbour
> 2× upscale of the content) is a different operation and is deliberately not in scope — it is
> easy to add later as `scaleArtworkCommand` using the same snapshot/undo shape.

## 9.5 Settings page

`/settings` covers what is not per-sprite:

| Section | Contents |
| --- | --- |
| Appearance | theme, checkerboard colours |
| Editor defaults | default canvas size, default fps, grid on/off |
| Palettes | manage user palettes, import/export (reuses phase 8 components) |
| Data | storage usage, export backup, import backup (phase 10), delete all data |

Storage usage is worth showing because IndexedDB quota is the one hard wall users hit:

```ts
// src/lib/storage.ts
export interface StorageEstimate { usedBytes: number; quotaBytes: number; percent: number }

export async function estimateStorage(): Promise<StorageEstimate | null> {
  if (!navigator.storage?.estimate) return null;      // not in Firefox private mode / older Safari
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usedBytes: usage, quotaBytes: quota, percent: quota ? (usage / quota) * 100 : 0 };
}
```

Offer `navigator.storage.persist()` behind a "Keep my sprites" toggle — without it the browser
may evict IndexedDB under storage pressure, which for a local-only app means silent data loss.

---

## Done when

- [ ] The gallery lists every sprite with a crisp pixelated thumbnail, newest first.
- [ ] Search, tag filter and sort all work together and update live on any edit in another tab.
- [ ] Loading, empty and "no results" are three visibly different states.
- [ ] Create → lands in the editor on the new sprite; presets and custom sizes both work.
- [ ] Rename, duplicate and tag edits reflect in the grid immediately (no manual refresh).
- [ ] Delete asks first and removes all layers and cels (no orphans; verify in DevTools).
- [ ] Resize crops/pads from the chosen anchor, warns before discarding pixels, and undoes exactly.
- [ ] Scrolling a gallery of 200 sprites does not grow memory (object URLs are revoked).
- [ ] Settings shows real storage usage and can request persistent storage.
