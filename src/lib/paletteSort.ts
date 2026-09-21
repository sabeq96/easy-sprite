import { hexToRgba, rgbToHsv } from "@/lib/color";

/** 12 × 30° bins: wide enough to keep a hue with its shades, narrow enough to split red from
 *  orange. */
const HUE_BUCKETS = 12;
const BUCKET_DEGREES = 360 / HUE_BUCKETS;
/** Below this, hue is numerical noise (and is exactly 0 for pure grays), so the color reads as
 *  neutral and belongs in the leading ramp, not a hue band. Chosen to sit in the gap between the
 *  starter palettes' muted "slate" tones (e.g. #757161, s≈0.17) and their first real colors
 *  (e.g. #83769c, s≈0.24). */
const NEUTRAL_SATURATION = 0.2;

interface SortKey {
  band: number;
  bucket: number;
  value: number;
  saturation: number;
  hex: string;
}

function sortKey(hex: string): SortKey {
  const { h, s, v } = rgbToHsv(hexToRgba(hex));
  if (s < NEUTRAL_SATURATION) return { band: 0, bucket: 0, value: v, saturation: s, hex };
  // Offset by half a bucket so reds at 355° and 5° share one bucket instead of landing at
  // opposite ends of the palette.
  const bucket = Math.floor(((h + BUCKET_DEGREES / 2) % 360) / BUCKET_DEGREES);
  return { band: 1, bucket, value: v, saturation: s, hex };
}

/**
 * Neutrals first as a black→white ramp, then hue bands red→magenta, each band ramping
 * light→dark — the band's main color leads, its darker/muted variants trail. Duplicates
 * collapse: the palette grid keys its sortable swatches by `palette:<hex>`, so a repeated hex
 * would be a duplicate drag id.
 */
export function sortColorsByHue(colors: string[]): string[] {
  return [...new Set(colors)]
    .map(sortKey)
    .sort(
      (a, b) =>
        a.band - b.band ||
        a.bucket - b.bucket ||
        // Neutrals ramp dark→light; every other band ramps light→dark.
        (a.band === 0 ? a.value - b.value : b.value - a.value) ||
        a.saturation - b.saturation ||
        a.hex.localeCompare(b.hex),
    )
    .map((entry) => entry.hex);
}
