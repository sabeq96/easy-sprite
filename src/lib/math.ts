export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** The next ladder entry strictly above (1) or below (-1) `value`, which may sit between entries. */
export function stepLadder(
  value: number,
  ladder: readonly number[],
  direction: 1 | -1,
): number {
  const epsilon = 1e-9;
  return direction > 0
    ? (ladder.find((entry) => entry > value + epsilon) ?? ladder[ladder.length - 1])
    : (ladder.findLast((entry) => entry < value - epsilon) ?? ladder[0]);
}
