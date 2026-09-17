import { BACKUP_FORMAT_VERSION } from "@/constants/storage";
import { db } from "@/db/db";
import { withQuotaGuard } from "@/db/errors";
import type { CelRecord, LayerRecord, PaletteRecord, SettingRecord, SpriteRecord } from "@/db/schema";
import { deflate, fromBase64, inflate, toBase64 } from "@/lib/binary";
import { err, ok, type Result } from "@/types/result";
import type {
  BackupCel,
  BackupFile,
  BackupSprite,
  ImportMode,
  ImportSummary,
} from "@/types/backup";

export type ProgressCallback = (done: number, total: number) => void;

export async function exportBackup(onProgress?: ProgressCallback): Promise<BackupFile> {
  const [sprites, layers, cels, palettes, settings] = await Promise.all([
    db.sprites.toArray(),
    db.layers.toArray(),
    db.cels.toArray(),
    db.palettes.toArray(),
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

  const backupSprites: BackupSprite[] = await Promise.all(
    sprites.map(async ({ thumbnail, ...sprite }) => ({
      ...sprite,
      ...(thumbnail ? { thumbnail: toBase64(new Uint8Array(await thumbnail.arrayBuffer())) } : {}),
    })),
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
    },
    sprites: backupSprites,
    layers,
    cels: backupCels,
    // Built-ins are re-seeded on boot, so shipping them would resurrect stale sets.
    palettes: palettes.filter((palette) => !palette.builtIn),
    settings,
  };
}

export function validateBackup(file: unknown): Result<BackupFile> {
  if (!file || typeof file !== "object") return err("That file is not a JSON object.");

  const candidate = file as Partial<BackupFile>;
  if (candidate.format !== "sprite-editor-backup") {
    return err("That is not a Sprite Editor backup file.");
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

  const sprites: SpriteRecord[] = backup.sprites.map(({ thumbnail, ...sprite }) => ({
    ...sprite,
    thumbnail: thumbnail ? new Blob([fromBase64(thumbnail)], { type: "image/png" }) : null,
  }));

  let keptSprites = sprites;
  let keptLayers: LayerRecord[] = backup.layers;
  let keptCels = cels;
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
  }

  await applyImport(keptSprites, keptLayers, keptCels, backup.palettes, backup.settings, mode);

  return ok({ sprites: keptSprites.length, palettes: backup.palettes.length, skipped });
}

/** One transaction, so a failure halfway leaves the database untouched. */
function applyImport(
  sprites: SpriteRecord[],
  layers: LayerRecord[],
  cels: CelRecord[],
  palettes: PaletteRecord[],
  settings: SettingRecord[],
  mode: ImportMode,
): Promise<void> {
  return withQuotaGuard(() =>
    db.transaction(
      "rw",
      db.sprites,
      db.layers,
      db.cels,
      db.palettes,
      db.settings,
      async () => {
        if (mode === "replace") {
          await db.cels.clear();
          await db.layers.clear();
          await db.sprites.clear();
          await db.palettes.filter((palette) => !palette.builtIn).delete();
        }

        await db.sprites.bulkPut(sprites);
        await db.layers.bulkPut(layers);
        await db.cels.bulkPut(cels);
        await db.palettes.bulkPut(palettes);
        await db.settings.bulkPut(settings);
      },
    ),
  );
}

/** Wipes user data, keeping built-in palettes (they are re-seeded anyway). */
export function clearAllData(): Promise<void> {
  return db.transaction("rw", db.sprites, db.layers, db.cels, db.palettes, async () => {
    await db.cels.clear();
    await db.layers.clear();
    await db.sprites.clear();
    await db.palettes.filter((palette) => !palette.builtIn).delete();
  });
}
