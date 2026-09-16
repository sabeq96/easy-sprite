# Phase 1 — Data layer (Dexie schema + repositories)

**Goal:** a fully typed, tested persistence layer. At the end of this phase you can create,
load, duplicate and delete sprites from the console, and the data survives a reload — with no UI
and no canvas code involved.

**Est.** 1 day · **Depends on:** phase 0

---

## 1.1 The record shape

Normalised into four tables. The important call is **cels as their own table**: a cel is
(layer × frame) pixels, and it is the unit that changes while drawing. Nesting pixels inside the
sprite record would mean rewriting every frame of every layer on each autosave.

`src/db/schema.ts`

```ts
/** Everything persisted lives here. Runtime-only types belong in src/types. */

export interface FrameMeta {
  id: string;
  /** Per-frame hold multiplier (1 = one tick at the sprite fps). Reserved for a later phase. */
  durationScale?: number;
}

export interface SpriteRecord {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  /** Layer ids, bottom → top. Order lives here so reordering is a single-record write. */
  layerIds: string[];
  /** Frame order, left → right. */
  frames: FrameMeta[];
  paletteId: string | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  /** PNG of frame 0, max 128px, regenerated on a throttle. Lossy is fine here. */
  thumbnail: Blob | null;
}

export interface LayerRecord {
  id: string;
  spriteId: string;
  name: string;
  /** 0–1 */
  opacity: number;
  visible: boolean;
  locked: boolean;
}

export interface CelRecord {
  /** Deterministic: `${layerId}:${frameId}` — lets us upsert without a lookup. */
  id: string;
  spriteId: string;
  layerId: string;
  frameId: string;
  /** Straight (non-premultiplied) RGBA, length = width * height * 4. */
  pixels: Uint8ClampedArray;
}

export interface PaletteRecord {
  id: string;
  name: string;
  /** `#rrggbb` or `#rrggbbaa`, in display order. */
  colors: string[];
  builtIn: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SettingRecord<T = unknown> {
  key: string;
  value: T;
}
```

**Empty cels are not stored.** A cel whose pixels are entirely `a === 0` is deleted rather than
written; a missing cel is read as transparent. For a 4-layer sprite where most layers are sparse
this roughly halves the database, and it makes "add 20 frames" cheap.

## 1.2 The Dexie instance

`src/db/db.ts`

```ts
import { Dexie, type EntityTable } from 'dexie';
import { DB_NAME } from '@/constants/storage';
import type { CelRecord, LayerRecord, PaletteRecord, SettingRecord, SpriteRecord } from '@/db/schema';

export type SpriteEditorDB = Dexie & {
  sprites: EntityTable<SpriteRecord, 'id'>;
  layers: EntityTable<LayerRecord, 'id'>;
  cels: EntityTable<CelRecord, 'id'>;
  palettes: EntityTable<PaletteRecord, 'id'>;
  settings: EntityTable<SettingRecord, 'key'>;
};

export const db = new Dexie(DB_NAME) as SpriteEditorDB;

db.version(1).stores({
  // Primary key first, then secondary indexes. Ids are app-generated UUIDs, so no `++`.
  sprites: 'id, name, updatedAt, *tags',
  layers: 'id, spriteId',
  cels: 'id, spriteId, layerId, frameId, [layerId+frameId]',
  palettes: 'id, name, builtIn, updatedAt',
  settings: 'key',
});
```

### Migration policy

Never edit a shipped `version(n)` block. Add a new one:

```ts
// Example for a future change — keep as the template.
db.version(2)
  .stores({ sprites: 'id, name, updatedAt, *tags, paletteId' })
  .upgrade((tx) =>
    tx.table<SpriteRecord>('sprites').toCollection().modify((sprite) => {
      sprite.paletteId ??= null;
    }),
  );
```

Dexie replays upgrades in order for users on older versions. The JSON backup format
(`BACKUP_FORMAT_VERSION`) versions independently — phase 10 covers that.

## 1.3 Errors

`src/db/errors.ts`

```ts
export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class QuotaError extends Error {
  constructor() {
    super('Storage is full. Export a backup and delete some sprites.');
    this.name = 'QuotaError';
  }
}

/** Wrap any write so a browser quota failure becomes an error the UI can explain. */
export async function withQuotaGuard<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') throw new QuotaError();
    throw error;
  }
}
```

## 1.4 Sprite repository

Every DB access in the app goes through a repository — components never touch `db.*` directly.
That keeps queries in one place and makes them testable in node.

`src/db/repositories/sprites.ts`

```ts
import { db } from '@/db/db';
import { NotFoundError, withQuotaGuard } from '@/db/errors';
import type { CelRecord, LayerRecord, SpriteRecord } from '@/db/schema';
import { createId } from '@/lib/id';
import { DEFAULT_CANVAS_SIZE } from '@/constants/canvas';
import { DEFAULT_FPS } from '@/constants/animation';

export interface SpriteSnapshot {
  sprite: SpriteRecord;
  layers: LayerRecord[];   // already ordered bottom → top
  cels: CelRecord[];
}

export interface CreateSpriteOptions {
  name?: string;
  width?: number;
  height?: number;
  fps?: number;
  paletteId?: string | null;
}

export async function createSprite(options: CreateSpriteOptions = {}): Promise<SpriteRecord> {
  const now = Date.now();
  const layerId = createId();
  const sprite: SpriteRecord = {
    id: createId(),
    name: options.name?.trim() || 'Untitled',
    width: options.width ?? DEFAULT_CANVAS_SIZE,
    height: options.height ?? DEFAULT_CANVAS_SIZE,
    fps: options.fps ?? DEFAULT_FPS,
    layerIds: [layerId],
    frames: [{ id: createId() }],
    paletteId: options.paletteId ?? null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    thumbnail: null,
  };

  await withQuotaGuard(() =>
    db.transaction('rw', db.sprites, db.layers, async () => {
      await db.sprites.add(sprite);
      await db.layers.add({
        id: layerId, spriteId: sprite.id, name: 'Layer 1', opacity: 1, visible: true, locked: false,
      });
      // No cel row: an empty cel is implicit.
    }),
  );

  return sprite;
}

export function listSprites() {
  return db.sprites.orderBy('updatedAt').reverse().toArray();
}

/** Live-query friendly: pass the raw query into useLiveQuery, not this wrapper's result. */
export function searchSprites(term: string) {
  const needle = term.trim().toLowerCase();
  if (!needle) return listSprites();
  return db.sprites
    .filter((s) => s.name.toLowerCase().includes(needle) || s.tags.some((t) => t.includes(needle)))
    .reverse()
    .sortBy('updatedAt');
}

export async function getSprite(id: string): Promise<SpriteRecord> {
  const sprite = await db.sprites.get(id);
  if (!sprite) throw new NotFoundError('Sprite', id);
  return sprite;
}

/** Everything the editor needs to open a document, in one transaction. */
export async function loadSnapshot(id: string): Promise<SpriteSnapshot> {
  return db.transaction('r', db.sprites, db.layers, db.cels, async () => {
    const sprite = await getSprite(id);
    const layers = await db.layers.where('spriteId').equals(id).toArray();
    const cels = await db.cels.where('spriteId').equals(id).toArray();
    const order = new Map(sprite.layerIds.map((layerId, index) => [layerId, index]));
    layers.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return { sprite, layers, cels };
  });
}

export function updateSprite(id: string, patch: Partial<Omit<SpriteRecord, 'id' | 'createdAt'>>) {
  return withQuotaGuard(() => db.sprites.update(id, { ...patch, updatedAt: Date.now() }));
}

export async function duplicateSprite(id: string): Promise<SpriteRecord> {
  const { sprite, layers, cels } = await loadSnapshot(id);
  const now = Date.now();

  // Remap every id so the copy is fully independent.
  const layerIdMap = new Map(layers.map((layer) => [layer.id, createId()]));
  const frameIdMap = new Map(sprite.frames.map((frame) => [frame.id, createId()]));

  const copy: SpriteRecord = {
    ...sprite,
    id: createId(),
    name: `${sprite.name} copy`,
    layerIds: sprite.layerIds.map((layerId) => layerIdMap.get(layerId)!),
    frames: sprite.frames.map((frame) => ({ ...frame, id: frameIdMap.get(frame.id)! })),
    createdAt: now,
    updatedAt: now,
  };

  const copiedLayers = layers.map((layer) => ({
    ...layer, id: layerIdMap.get(layer.id)!, spriteId: copy.id,
  }));

  const copiedCels = cels.map((cel) => {
    const layerId = layerIdMap.get(cel.layerId)!;
    const frameId = frameIdMap.get(cel.frameId)!;
    return {
      id: `${layerId}:${frameId}`,
      spriteId: copy.id,
      layerId,
      frameId,
      pixels: new Uint8ClampedArray(cel.pixels), // copy the buffer, never share it
    };
  });

  await withQuotaGuard(() =>
    db.transaction('rw', db.sprites, db.layers, db.cels, async () => {
      await db.sprites.add(copy);
      await db.layers.bulkAdd(copiedLayers);
      await db.cels.bulkAdd(copiedCels);
    }),
  );

  return copy;
}

export function removeSprite(id: string) {
  return db.transaction('rw', db.sprites, db.layers, db.cels, async () => {
    await db.cels.where('spriteId').equals(id).delete();
    await db.layers.where('spriteId').equals(id).delete();
    await db.sprites.delete(id);
  });
}
```

## 1.5 Cel repository

`src/db/repositories/cels.ts`

```ts
import { db } from '@/db/db';
import { withQuotaGuard } from '@/db/errors';
import type { CelRecord } from '@/db/schema';

export function celKey(layerId: string, frameId: string): string {
  return `${layerId}:${frameId}`;
}

export interface CelWrite {
  spriteId: string;
  layerId: string;
  frameId: string;
  pixels: Uint8ClampedArray;
}

/** True when nothing is visible — such cels are deleted instead of stored. */
export function isCelEmpty(pixels: Uint8ClampedArray): boolean {
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 0) return false;
  return true;
}

/**
 * One transaction for a whole autosave flush: writes non-empty cels, deletes emptied ones.
 * Buffers are copied because IndexedDB structured-clones asynchronously and the caller keeps
 * drawing into the live array.
 */
export function flushCels(writes: CelWrite[]) {
  const toPut: CelRecord[] = [];
  const toDelete: string[] = [];

  for (const write of writes) {
    const id = celKey(write.layerId, write.frameId);
    if (isCelEmpty(write.pixels)) toDelete.push(id);
    else toPut.push({ id, ...write, pixels: new Uint8ClampedArray(write.pixels) });
  }

  return withQuotaGuard(() =>
    db.transaction('rw', db.cels, async () => {
      if (toPut.length) await db.cels.bulkPut(toPut);
      if (toDelete.length) await db.cels.bulkDelete(toDelete);
    }),
  );
}

export function removeCelsForLayer(layerId: string) {
  return db.cels.where('layerId').equals(layerId).delete();
}

export function removeCelsForFrame(frameId: string) {
  return db.cels.where('frameId').equals(frameId).delete();
}

export function getCel(layerId: string, frameId: string) {
  return db.cels.get(celKey(layerId, frameId));
}
```

## 1.6 Layer, palette and settings repositories

`src/db/repositories/layers.ts`

```ts
import { db } from '@/db/db';
import type { LayerRecord } from '@/db/schema';
import { removeCelsForLayer } from '@/db/repositories/cels';

export function saveLayers(layers: LayerRecord[]) {
  return db.layers.bulkPut(layers);
}

export function removeLayer(layerId: string) {
  return db.transaction('rw', db.layers, db.cels, async () => {
    await removeCelsForLayer(layerId);
    await db.layers.delete(layerId);
  });
}
```

`src/db/repositories/palettes.ts`

```ts
import { db } from '@/db/db';
import type { PaletteRecord } from '@/db/schema';
import { createId } from '@/lib/id';

export function listPalettes() {
  return db.palettes.orderBy('name').toArray();
}

export function getPalette(id: string) {
  return db.palettes.get(id);
}

export async function createPalette(name: string, colors: string[]): Promise<PaletteRecord> {
  const now = Date.now();
  const palette: PaletteRecord = {
    id: createId(), name, colors, builtIn: false, createdAt: now, updatedAt: now,
  };
  await db.palettes.add(palette);
  return palette;
}

export function updatePalette(id: string, patch: Partial<Pick<PaletteRecord, 'name' | 'colors'>>) {
  return db.palettes.update(id, { ...patch, updatedAt: Date.now() });
}

/** Built-ins are re-seeded on every boot, so deleting one would be pointless. */
export async function removePalette(id: string) {
  const palette = await db.palettes.get(id);
  if (palette?.builtIn) throw new Error('Built-in palettes cannot be deleted. Duplicate it instead.');
  return db.palettes.delete(id);
}
```

`src/db/repositories/settings.ts` — one typed key-value table for app preferences (last opened
sprite, grid on/off, onion config, export defaults):

```ts
import { db } from '@/db/db';

export async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return (row?.value as T) ?? fallback;
}

export function writeSetting<T>(key: string, value: T) {
  return db.settings.put({ key, value });
}
```

`src/constants/settings.ts` keeps the key strings in one place so they can't drift:

```ts
export const SETTING_KEYS = {
  lastSpriteId: 'lastSpriteId',
  gridEnabled: 'view.grid',
  onion: 'view.onion',
  exportDefaults: 'export.defaults',
  activePaletteId: 'palette.active',
} as const;
```

## 1.7 Seeding built-in palettes

`src/constants/palettes.ts` (data only):

```ts
export interface BuiltInPalette { id: string; name: string; colors: string[] }

export const BUILT_IN_PALETTES: BuiltInPalette[] = [
  {
    id: 'builtin-dawnbringer-16',
    name: 'DawnBringer 16',
    colors: ['#140c1c','#442434','#30346d','#4e4a4e','#854c30','#346524','#d04648','#757161',
             '#597dce','#d27d2c','#8595a1','#6daa2c','#d2aa99','#6dc2ca','#dad45e','#deeed6'],
  },
  {
    id: 'builtin-pico-8',
    name: 'PICO-8',
    colors: ['#000000','#1d2b53','#7e2553','#008751','#ab5236','#5f574f','#c2c3c7','#fff1e8',
             '#ff004d','#ffa300','#ffec27','#00e436','#29adff','#83769c','#ff77a8','#ffccaa'],
  },
  {
    id: 'builtin-nes',
    name: 'NES',
    colors: ['#000000','#fcfcfc','#f8f8f8','#bcbcbc','#7c7c7c','#a4e4fc','#3cbcfc','#0078f8',
             '#0000fc','#b8b8f8','#6888fc','#0058f8','#d8b8f8','#9878f8','#6844fc','#f8b8f8'],
  },
  {
    id: 'builtin-grayscale',
    name: 'Grayscale 8',
    colors: ['#000000','#242424','#484848','#6d6d6d','#919191','#b6b6b6','#dadada','#ffffff'],
  },
];
```

`src/db/seed.ts`

```ts
import { db } from '@/db/db';
import { BUILT_IN_PALETTES } from '@/constants/palettes';
import type { PaletteRecord } from '@/db/schema';

/**
 * Idempotent: runs on every boot so new built-ins ship to existing users, but never
 * clobbers a user palette (built-ins own a reserved `builtin-` id prefix).
 */
export async function seedDatabase(): Promise<void> {
  const now = Date.now();
  const rows: PaletteRecord[] = BUILT_IN_PALETTES.map((palette) => ({
    ...palette, builtIn: true, createdAt: now, updatedAt: now,
  }));
  await db.palettes.bulkPut(rows);
}
```

Call it once at startup, before the app renders, from `src/main.tsx`:

```ts
await seedDatabase();   // top-level await is fine — Vite targets ESM
```

## 1.8 Tests

`src/db/repositories/sprites.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { createSprite, duplicateSprite, loadSnapshot, removeSprite } from '@/db/repositories/sprites';
import { celKey, flushCels } from '@/db/repositories/cels';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('sprite repository', () => {
  it('creates a sprite with one layer and one frame', async () => {
    const sprite = await createSprite({ name: 'Hero', width: 16, height: 16 });
    const snapshot = await loadSnapshot(sprite.id);

    expect(snapshot.layers).toHaveLength(1);
    expect(snapshot.sprite.frames).toHaveLength(1);
    expect(snapshot.cels).toHaveLength(0); // empty cels are implicit
  });

  it('duplicates without sharing ids or buffers', async () => {
    const sprite = await createSprite({ width: 2, height: 1 });
    const [layerId] = sprite.layerIds;
    const frameId = sprite.frames[0].id;
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0]);
    await flushCels([{ spriteId: sprite.id, layerId, frameId, pixels }]);

    const copy = await duplicateSprite(sprite.id);
    const snapshot = await loadSnapshot(copy.id);

    expect(copy.id).not.toBe(sprite.id);
    expect(snapshot.layers[0].id).not.toBe(layerId);
    expect(snapshot.cels[0].id).toBe(celKey(snapshot.layers[0].id, copy.frames[0].id));
    expect(Array.from(snapshot.cels[0].pixels)).toEqual(Array.from(pixels));
  });

  it('cascades deletes to layers and cels', async () => {
    const sprite = await createSprite();
    await flushCels([{
      spriteId: sprite.id, layerId: sprite.layerIds[0], frameId: sprite.frames[0].id,
      pixels: new Uint8ClampedArray([1, 2, 3, 255]),
    }]);

    await removeSprite(sprite.id);

    expect(await db.layers.count()).toBe(0);
    expect(await db.cels.count()).toBe(0);
  });

  it('deletes rather than stores a fully transparent cel', async () => {
    const sprite = await createSprite({ width: 1, height: 1 });
    const write = {
      spriteId: sprite.id, layerId: sprite.layerIds[0], frameId: sprite.frames[0].id,
      pixels: new Uint8ClampedArray([255, 0, 0, 255]),
    };
    await flushCels([write]);
    expect(await db.cels.count()).toBe(1);

    await flushCels([{ ...write, pixels: new Uint8ClampedArray(4) }]);
    expect(await db.cels.count()).toBe(0);
  });
});
```

---

## Done when

- [ ] `npm run test` — all repository tests pass against `fake-indexeddb`.
- [ ] Built-in palettes appear in `db.palettes` after a fresh boot, and re-seeding does not
      duplicate them or overwrite a user palette.
- [ ] Creating a sprite in one tab and reloading shows it in `listSprites()`.
- [ ] `npm run lint` — nothing in `src/db/**` imports from `src/editor/**` or `src/components/**`.
- [ ] Deleting a sprite leaves zero orphan rows in `layers` and `cels`.
