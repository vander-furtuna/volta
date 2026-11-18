export const MS_PER_DAY = 86_400_000;

/** Whole days elapsed from `from` until `to` (rounded down). */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] as number;
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[middle - 1] as number;
  return (lower + upper) / 2;
}
