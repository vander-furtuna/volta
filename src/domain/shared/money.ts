/**
 * Money inside the domain is integer cents, so sums and comparisons never drift.
 * Conversion to and from decimals happens only at the boundary (CW payloads and the database
 * numeric(12,2) columns).
 */

export function toCents(decimal: number): number {
  if (!Number.isFinite(decimal)) throw new Error("Money value must be a finite number.");
  return Math.round(decimal * 100);
}

export function fromCents(cents: number): number {
  if (!Number.isSafeInteger(cents)) throw new Error("Money value must be an integer of cents.");
  return cents / 100;
}
