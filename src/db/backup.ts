import { BACKUP_FORMAT_VERSION } from "@/constants/storage";
import { db } from "@/db/db";
import { withQuotaGuard } from "@/db/errors";
import { seedDatabase } from "@/db/seed";
import type { CelRecord, LayerRecord, SpriteRecord, SpritesheetRecord } from "@/db/schema";
import { deflate, fromBase64, inflate, toBase64 } from "@/lib/binary";
import { err, ok, type Result } from "@/types/result";
import type {
  BackupCel,
  BackupFile,
  BackupSprite,
  BackupSpritesheet,
  ImportMode,
  ImportSummary,
} from "@/types/backup";

export type ProgressCallback = (done: number, total: number) => void;

export async function exportBackup(onProgress?: ProgressCallback): Promise<BackupFile> {
  const [sprites, layers, cels, palettes, spritesheets, settings] = await Promise.all([
    db.sprites.toArray(),
    db.layers.toArray(),
    db.cels.toArray(),
    db.palettes.toArray(),
    db.spritesheets.toArray(),
    db.settings.toArray(),
  ]);

  const backupCels: BackupCel[] = [];
  for (const [index, cel] of cels.entries()) {
    const bytes = new Uint8Array(cel.pixels.buffer, cel.pixels.byteOffset, cel.pixels.length);
    backupCels.push({
      id: cel.id,
      spriteId: cel.spriteId,
      layerId: cel.layerId,
      frameId: cel.frameId,
      data: toBase64(await deflate(bytes)),
    });
    onProgress?.(index + 1, cels.length);
  }

  const backupSprites: BackupSprite[] = await Promise.all(sprites.map(encodeThumbnail));
  const backupSpritesheets: BackupSpritesheet[] = await Promise.all(
    spritesheets.map(encodeThumbnail),
  );

  return {
    format: "sprite-editor-backup",
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      sprites: sprites.length,
      layers: layers.length,
      cels: cels.length,
      palettes: palettes.length,
      spritesheets: spritesheets.length,
    },
    sprites: backupSprites,
    layers,
    cels: backupCels,
    // Seeded palettes are ordinary palettes now, so every one of them is user data.
    palettes,
    spritesheets: backupSpritesheets,
    settings,
  };
}

export function validateBackup(file: unknown): Result<BackupFile> {
  if (!file || typeof file !== "object") return err("That file is not a JSON object.");

  const candidate = file as Partial<BackupFile>;
  if (candidate.format !== "sprite-editor-backup") {
    return err("That is not an Easy Sprite backup file.");
  }
  if (typeof candidate.version !== "number") return err("That backup has no version.");
  if (candidate.version > BACKUP_FORMAT_VERSION) {
    return err(
      `That backup was made by a newer version (v${candidate.version}). Update the app first.`,
    );
  }
  for (const key of ["sprites", "layers", "cels", "palettes"] as const) {
    if (!Array.isArray(candidate[key])) return err(`Backup is missing "${key}".`);
  }
  // Absent in a v1 backup, made before spritesheets existed — optional, not required.
  if (candidate.spritesheets !== undefined && !Array.isArray(candidate.spritesheets)) {
    return err(`Backup is missing "spritesheets".`);
  }

  return ok(candidate as BackupFile);
}

export async function importBackup(
  file: unknown,
  mode: ImportMode,
): Promise<Result<ImportSummary>> {
  const validation = validateBackup(file);
  if (!validation.ok) return validation;
  const backup = validation.value;

  // Decompress outside the transaction: an IndexedDB transaction auto-closes on an await
  // that is not an IDB request, and inflate() is exactly such an await.
  const cels: CelRecord[] = await Promise.all(
    backup.cels.map(async (cel) => ({
      id: cel.id,
      spriteId: cel.spriteId,
      layerId: cel.layerId,
      frameId: cel.frameId,
      pixels: new Uint8ClampedArray(await inflate(fromBase64(cel.data))),
    })),
  );

  const sprites: SpriteRecord[] = backup.sprites.map(decodeThumbnail);
  const spritesheets: SpritesheetRecord[] = (backup.spritesheets ?? []).map(decodeThumbnail);

  let keptSprites = sprites;
  let keptLayers: LayerRecord[] = backup.layers;
  let keptCels = cels;
  let keptSheets = spritesheets;
  let skipped = 0;

  if (mode === "merge") {
    const existing = new Set((await db.sprites.toArray()).map((sprite) => sprite.id));
    // Ids are UUIDs, so a collision means the same sprite — keep the local copy.
    const conflicts = new Set(
      sprites.filter((sprite) => existing.has(sprite.id)).map((sprite) => sprite.id),
    );
    skipped = conflicts.size;

    if (conflicts.size) {
      keptSprites = sprites.filter((sprite) => !conflicts.has(sprite.id));
      keptLayers = backup.layers.filter((layer) => !conflicts.has(layer.spriteId));
      keptCels = cels.filter((cel) => !conflicts.has(cel.spriteId));
    }

    const existingSheets = new Set((await db.spritesheets.toArray()).map((sheet) => sheet.id));
    keptSheets = spritesheets.filter((sheet) => !existingSheets.has(sheet.id));
  }

  // One transaction, so a failure halfway leaves the database untouched.
  await withQuotaGuard(() =>
    db.transaction(
      "rw",
      [db.sprites, db.layers, db.cels, db.palettes, db.spritesheets, db.settings],
      async () => {
        if (mode === "replace") {
          await db.cels.clear();
          await db.layers.clear();
          await db.sprites.clear();
          await db.spritesheets.clear();
          await db.palettes.clear();
        }

        await db.sprites.bulkPut(keptSprites);
        await db.layers.bulkPut(keptLayers);
        await db.cels.bulkPut(keptCels);
        await db.palettes.bulkPut(backup.palettes);
        await db.spritesheets.bulkPut(keptSheets);
        await db.settings.bulkPut(backup.settings);
      },
    ),
  );

  return ok({
    sprites: keptSprites.length,
    palettes: backup.palettes.length,
    spritesheets: keptSheets.length,
    skipped,
  });
}

/** Sprite and Spritesheet thumbnails travel as base64 PNG; omitted when there is none yet. */
async function encodeThumbnail<T extends { thumbnail: Blob | null }>({
  thumbnail,
  ...record
}: T): Promise<Omit<T, "thumbnail"> & { thumbnail?: string }> {
  return {
    ...record,
    ...(thumbnail ? { thumbnail: toBase64(new Uint8Array(await thumbnail.arrayBuffer())) } : {}),
  };
}

function decodeThumbnail<T extends { thumbnail?: string }>({
  thumbnail,
  ...record
}: T): Omit<T, "thumbnail"> & { thumbnail: Blob | null } {
  return {
    ...record,
    thumbnail: thumbnail ? new Blob([fromBase64(thumbnail)], { type: "image/png" }) : null,
  };
}

/** Back to a first-run database: every table emptied, then starter content re-seeded. */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [db.sprites, db.layers, db.cels, db.palettes, db.spritesheets, db.settings],
    async () => {
      await db.cels.clear();
      await db.layers.clear();
      await db.sprites.clear();
      await db.spritesheets.clear();
      await db.palettes.clear();
      // Drops the seed marker along with everything else, so seedDatabase() below runs fresh.
      await db.settings.clear();
    },
  );
  await seedDatabase();
}
