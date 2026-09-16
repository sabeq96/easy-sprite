# Phase 10 — Export & backup

**Goal:** get data out and back in. Spritesheet PNG export with layout/scale options, single-frame
PNG, and a full-database JSON backup that restores losslessly.

**Est.** 1 day · **Depends on:** phases 2 and 9

---

## 10.1 Spritesheet composition

Pure layout maths first, so the packing is testable without a canvas.

`src/export/spritesheetLayout.ts`

```ts
import type { SpritesheetLayout } from '@/constants/export';
import type { Rect } from '@/lib/rect';

export interface LayoutInput {
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  layout: SpritesheetLayout;
  /** Only used by the 'grid' layout. */
  columns?: number;
  scale: number;
  /** Transparent gutter between frames, in source pixels. */
  padding?: number;
  margin?: number;
}

export interface SheetLayout {
  width: number;
  height: number;
  columns: number;
  rows: number;
  /** Destination rect of each frame, in output pixels, in frame order. */
  frames: Rect[];
}

export function computeSheetLayout(input: LayoutInput): SheetLayout {
  const { frameCount, frameWidth, frameHeight, layout, scale } = input;
  const padding = (input.padding ?? 0) * scale;
  const margin = (input.margin ?? 0) * scale;
  const cellWidth = frameWidth * scale;
  const cellHeight = frameHeight * scale;

  const columns =
    layout === 'horizontal' ? frameCount :
    layout === 'vertical' ? 1 :
    Math.max(1, Math.min(input.columns ?? autoColumns(frameCount), frameCount));
  const rows = Math.ceil(frameCount / columns);

  const frames: Rect[] = Array.from({ length: frameCount }, (_, index) => ({
    x: margin + (index % columns) * (cellWidth + padding),
    y: margin + Math.floor(index / columns) * (cellHeight + padding),
    w: cellWidth,
    h: cellHeight,
  }));

  return {
    columns,
    rows,
    width: margin * 2 + columns * cellWidth + Math.max(0, columns - 1) * padding,
    height: margin * 2 + rows * cellHeight + Math.max(0, rows - 1) * padding,
    frames,
  };
}

/** Squarish sheet — the friendliest default for engines that don't care about layout. */
function autoColumns(frameCount: number): number {
  return Math.ceil(Math.sqrt(frameCount));
}
```

`src/export/spritesheet.ts`

```ts
import { compositeFrame } from '@/editor/composite';
import { computeSheetLayout, type SheetLayout } from '@/export/spritesheetLayout';
import type { SpriteDocument } from '@/editor/document';
import type { SpritesheetLayout } from '@/constants/export';

export interface SpritesheetOptions {
  layout: SpritesheetLayout;
  columns?: number;
  scale: number;
  padding?: number;
  margin?: number;
  includeHidden?: boolean;
  /** Flatten onto a solid colour instead of exporting transparency. */
  background?: string | null;
}

export interface SpritesheetResult {
  blob: Blob;
  layout: SheetLayout;
  /** JSON sidecar describing frame rects — useful for engines, written only if asked for. */
  metadata: SpritesheetMetadata;
}

export interface SpritesheetMetadata {
  name: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns: number;
  rows: number;
  fps: number;
  frames: { index: number; x: number; y: number; w: number; h: number }[];
}

export async function exportSpritesheet(
  doc: SpriteDocument, options: SpritesheetOptions,
): Promise<SpritesheetResult> {
  const layout = computeSheetLayout({
    frameCount: doc.frames.length,
    frameWidth: doc.width,
    frameHeight: doc.height,
    layout: options.layout,
    columns: options.columns,
    scale: options.scale,
    padding: options.padding,
    margin: options.margin,
  });

  const canvas = new OffscreenCanvas(layout.width, layout.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create the export canvas');

  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, layout.width, layout.height);
  }

  // Nearest-neighbour is non-negotiable: smoothing would blur a 1× sprite scaled to 8×.
  ctx.imageSmoothingEnabled = false;

  const scratch = new OffscreenCanvas(doc.width, doc.height);
  doc.frames.forEach((frame, index) => {
    const source = compositeFrame(doc, frame.id, scratch, { includeHidden: options.includeHidden });
    const target = layout.frames[index];
    ctx.drawImage(source, target.x, target.y, target.w, target.h);
  });

  const blob = await canvas.convertToBlob({ type: 'image/png' });

  return {
    blob,
    layout,
    metadata: {
      name: doc.name,
      frameWidth: doc.width * options.scale,
      frameHeight: doc.height * options.scale,
      frameCount: doc.frames.length,
      columns: layout.columns,
      rows: layout.rows,
      fps: doc.fps,
      frames: layout.frames.map((rect, index) => ({ index, ...rect })),
    },
  };
}

/** Single frame, same scaling rules — used by "Export current frame". */
export async function exportFramePng(
  doc: SpriteDocument, frameId: string, scale = 1,
): Promise<Blob> {
  const source = compositeFrame(doc, frameId);
  const canvas = new OffscreenCanvas(doc.width * scale, doc.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create the export canvas');

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: 'image/png' });
}
```

`src/export/download.ts`

```ts
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoke on the next tick — revoking synchronously cancels the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadJson(value: unknown, filename: string): void {
  downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), filename);
}

/** `Hero Walk` → `hero-walk` so filenames are portable. */
export function toFilenameSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sprite';
}
```

`src/export/spritesheetLayout.test.ts`:

```ts
it('lays 7 frames of 16px into a 3-column grid with 1px padding', () => {
  const layout = computeSheetLayout({
    frameCount: 7, frameWidth: 16, frameHeight: 16, layout: 'grid', columns: 3, scale: 1, padding: 1,
  });
  expect(layout).toMatchObject({ columns: 3, rows: 3, width: 50, height: 50 });
  expect(layout.frames[3]).toEqual({ x: 0, y: 17, w: 16, h: 16 });
});
```

## 10.2 Export dialog

Live preview of the resulting sheet dimensions is the single most useful thing this dialog can
show — users pick scale and columns to hit a target size.

```tsx
export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { doc, autosave } = useDocumentSession();
  const [options, setOptions] = useState<SpritesheetOptions>(() => DEFAULT_EXPORT_OPTIONS);
  const [isExporting, setExporting] = useState(false);

  const layout = computeSheetLayout({ ...spriteDimensions(doc), ...options });

  const run = async () => {
    setExporting(true);
    try {
      await autosave.flush();                      // never export a stale document
      const { blob, metadata } = await exportSpritesheet(doc, options);
      const slug = toFilenameSlug(doc.name);
      downloadBlob(blob, `${slug}-sheet.png`);
      if (options.includeMetadata) downloadJson(metadata, `${slug}-sheet.json`);
      toast.success(`Exported ${doc.frames.length} frames · ${layout.width}×${layout.height}px`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };
  …
}
```

Defaults in `src/constants/export.ts`: `{ layout: 'horizontal', scale: 1, padding: 0, margin: 0,
includeHidden: false, background: null, includeMetadata: false }`. Persist the last-used options
in settings so repeat exports are one click.

## 10.3 Backup format

Everything in IndexedDB, in one JSON file, restorable on another machine.

The only hard part is pixels: a 64×64×24-cel sprite is ~6 MB of raw bytes, and `JSON.stringify`
of a plain array would be ~25 MB of text. So cels are **deflate-compressed and base64-encoded**
via the native `CompressionStream` — no dependency, and pixel art compresses roughly 20–50×.

`src/lib/binary.ts`

```ts
/** Uint8Array → base64. Chunked because String.fromCharCode(...huge) blows the stack. */
export function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
```

`src/types/backup.ts`

```ts
import type { LayerRecord, PaletteRecord, SettingRecord, SpriteRecord } from '@/db/schema';

export interface BackupCel {
  id: string; spriteId: string; layerId: string; frameId: string;
  /** base64(deflate-raw(RGBA bytes)) */
  data: string;
}

export type BackupSprite = Omit<SpriteRecord, 'thumbnail'> & {
  /** base64 PNG; omitted when the sprite has no thumbnail yet. */
  thumbnail?: string;
};

export interface BackupFile {
  format: 'sprite-editor-backup';
  version: number;
  exportedAt: string;
  counts: { sprites: number; layers: number; cels: number; palettes: number };
  sprites: BackupSprite[];
  layers: LayerRecord[];
  cels: BackupCel[];
  palettes: PaletteRecord[];
  settings: SettingRecord[];
}
```

`src/db/backup.ts`

```ts
import { db } from '@/db/db';
import { deflate, fromBase64, inflate, toBase64 } from '@/lib/binary';
import { BACKUP_FORMAT_VERSION } from '@/constants/storage';
import type { BackupFile, BackupSprite } from '@/types/backup';
import type { Result } from '@/types/result';

export async function exportBackup(onProgress?: (done: number, total: number) => void): Promise<BackupFile> {
  const [sprites, layers, cels, palettes, settings] = await Promise.all([
    db.sprites.toArray(), db.layers.toArray(), db.cels.toArray(),
    db.palettes.toArray(), db.settings.toArray(),
  ]);

  const backupCels = [];
  for (const [index, cel] of cels.entries()) {
    backupCels.push({
      id: cel.id, spriteId: cel.spriteId, layerId: cel.layerId, frameId: cel.frameId,
      data: toBase64(await deflate(new Uint8Array(cel.pixels.buffer, cel.pixels.byteOffset, cel.pixels.length))),
    });
    onProgress?.(index + 1, cels.length);
  }

  const backupSprites: BackupSprite[] = await Promise.all(
    sprites.map(async ({ thumbnail, ...sprite }) => ({
      ...sprite,
      ...(thumbnail ? { thumbnail: toBase64(new Uint8Array(await thumbnail.arrayBuffer())) } : {}),
    })),
  );

  return {
    format: 'sprite-editor-backup',
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    counts: { sprites: sprites.length, layers: layers.length, cels: cels.length, palettes: palettes.length },
    sprites: backupSprites,
    layers,
    cels: backupCels,
    palettes: palettes.filter((palette) => !palette.builtIn),   // built-ins are re-seeded on boot
    settings,
  };
}

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary { sprites: number; palettes: number; skipped: number }

export async function importBackup(
  file: BackupFile, mode: ImportMode,
): Promise<Result<ImportSummary>> {
  const validation = validateBackup(file);
  if (!validation.ok) return validation;

  // Decompress outside the transaction: IndexedDB transactions auto-close on an await
  // that isn't an IDB request, and inflate() is exactly such an await.
  const cels = await Promise.all(
    file.cels.map(async (cel) => ({
      id: cel.id, spriteId: cel.spriteId, layerId: cel.layerId, frameId: cel.frameId,
      pixels: new Uint8ClampedArray(await inflate(fromBase64(cel.data))),
    })),
  );

  const sprites = await Promise.all(
    file.sprites.map(async ({ thumbnail, ...sprite }) => ({
      ...sprite,
      thumbnail: thumbnail ? new Blob([fromBase64(thumbnail)], { type: 'image/png' }) : null,
    })),
  );

  let skipped = 0;
  if (mode === 'merge') {
    const existing = new Set((await db.sprites.toArray()).map((sprite) => sprite.id));
    const conflicts = new Set(sprites.filter((sprite) => existing.has(sprite.id)).map((s) => s.id));
    skipped = conflicts.size;
    // Ids are UUIDs, so a collision means "the same sprite" — keep the local copy.
    if (conflicts.size) {
      return applyImport(
        sprites.filter((sprite) => !conflicts.has(sprite.id)),
        file.layers.filter((layer) => !conflicts.has(layer.spriteId)),
        cels.filter((cel) => !conflicts.has(cel.spriteId)),
        file.palettes, file.settings, mode, skipped,
      );
    }
  }

  return applyImport(sprites, file.layers, cels, file.palettes, file.settings, mode, skipped);
}

async function applyImport(sprites, layers, cels, palettes, settings, mode: ImportMode, skipped: number) {
  await db.transaction('rw', db.sprites, db.layers, db.cels, db.palettes, db.settings, async () => {
    if (mode === 'replace') {
      await Promise.all([db.sprites.clear(), db.layers.clear(), db.cels.clear()]);
      await db.palettes.filter((palette) => !palette.builtIn).delete();
    }
    await db.sprites.bulkPut(sprites);
    await db.layers.bulkPut(layers);
    await db.cels.bulkPut(cels);
    await db.palettes.bulkPut(palettes);
    await db.settings.bulkPut(settings);
  });

  return { ok: true as const, value: { sprites: sprites.length, palettes: palettes.length, skipped } };
}

function validateBackup(file: unknown): Result<true> {
  if (!file || typeof file !== 'object') return { ok: false, error: 'That file is not JSON.' };
  const candidate = file as Partial<BackupFile>;
  if (candidate.format !== 'sprite-editor-backup') {
    return { ok: false, error: 'That is not a Sprite Editor backup file.' };
  }
  if (typeof candidate.version !== 'number' || candidate.version > BACKUP_FORMAT_VERSION) {
    return { ok: false, error: `That backup was made by a newer version (v${candidate.version}). Update the app first.` };
  }
  for (const key of ['sprites', 'layers', 'cels', 'palettes'] as const) {
    if (!Array.isArray(candidate[key])) return { ok: false, error: `Backup is missing "${key}".` };
  }
  return { ok: true, value: true };
}
```

### Backup rules

- **Never `JSON.parse` straight into the DB.** `validateBackup` runs first, and it returns a
  `Result` with a message a user can act on rather than throwing a stack trace at them.
- **Older versions import; newer ones refuse.** When `BACKUP_FORMAT_VERSION` increments, add a
  migration function keyed by version, mirroring the Dexie upgrade policy.
- **Built-in palettes are excluded** from backups and re-seeded on boot, so a backup taken before
  a new built-in ships does not resurrect an old set.
- **Import is a single transaction**, so a failure halfway leaves the database untouched.

## 10.4 Backup UI

In `/settings` → Data:

```tsx
export function BackupSection() {
  const [progress, setProgress] = useState<number | null>(null);
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null);

  const doExport = async () => {
    setProgress(0);
    const backup = await exportBackup((done, total) => setProgress(done / total));
    downloadJson(backup, `sprite-editor-backup-${new Date().toISOString().slice(0, 10)}.json`);
    setProgress(null);
  };

  const onFile = async (file: File) => {
    try {
      setPendingImport(JSON.parse(await file.text()) as BackupFile);   // confirm before touching the DB
    } catch {
      toast.error('That file is not valid JSON.');
    }
  };
  …
}
```

The import dialog shows what is in the file (`counts`, `exportedAt`) and forces an explicit choice
between **Merge** (keep existing, add new) and **Replace everything** — with the replace option
behind a typed confirmation, because it deletes every sprite the user has.

---

## Done when

- [ ] Horizontal, vertical and grid layouts produce the dimensions the dialog previewed.
- [ ] Exporting at 8× produces hard pixel edges, no anti-aliasing, and transparent gutters.
- [ ] Hidden layers are excluded by default and included when the option is on.
- [ ] The sidecar JSON's frame rects line up exactly with the PNG (verify in an engine or by
      slicing in an image editor).
- [ ] Export flushes pending autosave first — the sheet always matches what is on screen.
- [ ] A backup of a 20-sprite database exports in a few seconds and is a fraction of the raw size.
- [ ] Export → "Delete all data" → import restores every sprite, layer, cel, palette and setting,
      byte-identical (covered by a round-trip test against `fake-indexeddb`).
- [ ] Importing a corrupt or foreign JSON file shows a clear message and changes nothing.
- [ ] Merge mode keeps existing sprites and reports how many were skipped.
