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

/**
 * The calendar day (YYYY-MM-DD) before `now`, as seen in `timeZone`.
 * Used for the daily reconciliation, which covers the day that just closed in the restaurant's
 * time zone.
 */
export function previousDayInTimeZone(now: Date, timeZone: string): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, day] = today.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}
