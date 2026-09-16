/** Everything persisted lives here. Runtime-only types belong in src/types. */

import type { PixelBuffer } from "@/types/pixels";

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
  pixels: PixelBuffer;
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
