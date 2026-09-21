import { Dexie, type EntityTable } from "dexie";
import { SETTING_KEYS } from "@/constants/settings";
import { DB_NAME } from "@/constants/storage";
import type {
  CelRecord,
  LayerRecord,
  PaletteRecord,
  SettingRecord,
  SpriteRecord,
  SpritesheetRecord,
} from "@/db/schema";

export type SpriteEditorDB = Dexie & {
  sprites: EntityTable<SpriteRecord, "id">;
  layers: EntityTable<LayerRecord, "id">;
  cels: EntityTable<CelRecord, "id">;
  palettes: EntityTable<PaletteRecord, "id">;
  settings: EntityTable<SettingRecord, "key">;
  spritesheets: EntityTable<SpritesheetRecord, "id">;
};

export const db = new Dexie(DB_NAME) as SpriteEditorDB;

// Never edit a shipped version block — add a new `db.version(n).stores(...).upgrade(...)`.
db.version(1).stores({
  // Primary key first, then secondary indexes. Ids are app-generated UUIDs, so no `++`.
  sprites: "id, name, updatedAt, createdAt, *tags",
  layers: "id, spriteId",
  cels: "id, spriteId, layerId, frameId, [layerId+frameId]",
  palettes: "id, name, builtIn, updatedAt",
  settings: "key",
});

db.version(2).stores({
  spritesheets: "id, name, updatedAt, createdAt, *tags",
});

// v3 drops `builtIn`: seeded palettes are ordinary palettes now (and a boolean index is a no-op
// in IndexedDB anyway). Databases that already hold palettes are marked as seeded, so the first
// boot after this upgrade does not re-stamp them.
db.version(3)
  .stores({ palettes: "id, name, updatedAt" })
  .upgrade(async (tx) => {
    await tx
      .table<PaletteRecord & { builtIn?: boolean }>("palettes")
      .toCollection()
      .modify((palette) => {
        delete palette.builtIn;
      });
    if ((await tx.table("palettes").count()) > 0) {
      await tx.table("settings").put({ key: SETTING_KEYS.seeded, value: ["palettes"] });
    }
  });
