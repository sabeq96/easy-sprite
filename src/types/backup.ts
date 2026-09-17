import type { LayerRecord, PaletteRecord, SettingRecord, SpriteRecord } from "@/db/schema";

export interface BackupCel {
  id: string;
  spriteId: string;
  layerId: string;
  frameId: string;
  /** base64(deflate-raw(RGBA bytes)) */
  data: string;
}

export type BackupSprite = Omit<SpriteRecord, "thumbnail"> & {
  /** base64 PNG; omitted when the sprite has no thumbnail yet. */
  thumbnail?: string;
};

export interface BackupCounts {
  sprites: number;
  layers: number;
  cels: number;
  palettes: number;
}

export interface BackupFile {
  format: "sprite-editor-backup";
  version: number;
  exportedAt: string;
  counts: BackupCounts;
  sprites: BackupSprite[];
  layers: LayerRecord[];
  cels: BackupCel[];
  palettes: PaletteRecord[];
  settings: SettingRecord[];
}

export type ImportMode = "merge" | "replace";

export interface ImportSummary {
  sprites: number;
  palettes: number;
  /** Sprites already present locally, kept as-is in merge mode. */
  skipped: number;
}
