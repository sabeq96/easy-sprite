import type { SpriteDocument } from "@/editor/document";
import { packRgba, rgbaToHex, unpackRgba } from "@/lib/color";

export interface ColorUsage {
  hex: string;
  count: number;
}

/**
 * Every distinct non-transparent colour in the document, most-used first.
 * O(pixels), so callers run it on a debounce — never during a stroke.
 */
export function collectColorUsage(doc: SpriteDocument, limit = 256): ColorUsage[] {
  const counts = new Map<number, number>();

  for (const layer of doc.layers) {
    for (const frame of doc.frames) {
      const cel = doc.getCel(layer.id, frame.id);
      if (!cel) continue;

      const { pixels } = cel;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] === 0) continue;
        const key = packRgba({
          r: pixels[index],
          g: pixels[index + 1],
          b: pixels[index + 2],
          a: pixels[index + 3],
        });
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => {
      const color = unpackRgba(key);
      return { hex: rgbaToHex(color, color.a !== 255), count };
    });
}
