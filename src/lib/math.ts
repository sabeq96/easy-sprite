export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Snap to the nearest entry of an ascending ladder (zoom levels, fps presets). */
export function snapToLadder(value: number, ladder: readonly number[]): number {
  return ladder.reduce(
    (best, entry) => (Math.abs(entry - value) < Math.abs(best - value) ? entry : best),
    ladder[0],
  );
}

export function stepLadder(
  value: number,
  ladder: readonly number[],
  direction: 1 | -1,
): number {
  const index = ladder.indexOf(snapToLadder(value, ladder));
  return ladder[clamp(index + direction, 0, ladder.length - 1)];
}
