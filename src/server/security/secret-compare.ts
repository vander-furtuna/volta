import { timingSafeEqual } from "node:crypto";

/**
 * Compares two secrets in constant time. Use it wherever a value sent by a caller is checked
 * against a configured secret (CRON_SECRET, OAuth state), so timing cannot reveal the secret.
 */
export function secretsMatch(received: string | null, expected: string): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
