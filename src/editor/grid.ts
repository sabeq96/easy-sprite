function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

/**
 * Sizes (in px) that tile a sprite's full width and height evenly, capped at `max`. Any size
 * outside this set clips a partial cell at the sprite's right/bottom edge.
 */
export function tileSizeOptions(width: number, height: number, max: number): number[] {
  const common = gcd(Math.max(1, width), Math.max(1, height));
  const options: number[] = [];
  for (let size = 1; size <= Math.min(common, max); size++) {
    if (common % size === 0) options.push(size);
  }
  return options;
}

/** The option in `options` closest to `preferred`. */
export function snapTileSize(preferred: number, options: number[]): number {
  return options.reduce((best, option) =>
    Math.abs(option - preferred) < Math.abs(best - preferred) ? option : best,
  );
}
