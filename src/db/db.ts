import { Dexie, type EntityTable } from "dexie";
import { DB_NAME } from "@/constants/storage";
import type {
  CelRecord,
  LayerRecord,
  PaletteRecord,
  SettingRecord,
  SpriteRecord,
} from "@/db/schema";

export type SpriteEditorDB = Dexie & {
  sprites: EntityTable<SpriteRecord, "id">;
  layers: EntityTable<LayerRecord, "id">;
  cels: EntityTable<CelRecord, "id">;
  palettes: EntityTable<PaletteRecord, "id">;
  settings: EntityTable<SettingRecord, "key">;
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
