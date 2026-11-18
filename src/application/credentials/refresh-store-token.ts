import type { StoreCredentialsRepository, TokenRefresher } from "@/application/ports";

/** A refresh that holds the lock longer than this is assumed to have crashed. */
export const REFRESH_LEASE_SECONDS = 120;

export type RefreshOutcome =
  { status: "refreshed" } | { status: "busy" } | { status: "no_credentials" };

/**
 * Renews a store's access token with at most one refresh at a time.
 *
 * - Another worker holds a live lock: returns "busy" and does nothing.
 * - CW rejects the refresh: the lock is released without saving, so the next attempt can run.
 * - CW returns tokens: they are saved and the lock is released in one write.
 *
 * If CW rotated the refresh token and the save then fails, the lock stays until its lease
 * expires and the old refresh token may no longer work. This is the open question about
 * rotation in docs/open-questions.md (item 2).
 */
export async function refreshStoreToken(
  input: { storeId: string; now: Date },
  deps: { credentials: StoreCredentialsRepository; refresher: TokenRefresher },
): Promise<RefreshOutcome> {
  const locked = await deps.credentials.acquireRefreshLock(
    input.storeId,
    input.now,
    REFRESH_LEASE_SECONDS,
  );
  if (!locked) return { status: "busy" };

  const current = await deps.credentials.load(input.storeId);
  if (!current) {
    await deps.credentials.releaseRefreshLock(input.storeId);
    return { status: "no_credentials" };
  }

  let tokens;
  try {
    tokens = await deps.refresher.refresh(current.environment, current.refreshToken);
  } catch (error) {
    await deps.credentials.releaseRefreshLock(input.storeId);
    throw error;
  }

  await deps.credentials.saveRefreshedAndRelease(input.storeId, tokens, input.now);
  return { status: "refreshed" };
}
