import type { AccessEventInbox } from "@/application/ports";

/** Access events applied per run. CW sends few of them; the rest wait for the next run. */
export const ACCESS_EVENT_BATCH_SIZE = 50;

/**
 * Applies pending CW access events (MARKETPLACE_APP_ACCESS_UPDATED) to the store access state.
 * Runs in the background, never inside the webhook request, as CW recommends.
 *
 * Events are applied in arrival order, but correctness does not depend on it: the inbox ignores
 * a snapshot older than the one already applied. Errors propagate, leaving the event pending.
 */
export async function applyAccessEvents(
  now: Date,
  deps: { inbox: AccessEventInbox; batchSize?: number },
): Promise<{ applied: number; stale: number; waitingForStore: number }> {
  const events = await deps.inbox.listPending(deps.batchSize ?? ACCESS_EVENT_BATCH_SIZE);
  const result = { applied: 0, stale: 0, waitingForStore: 0 };

  for (const event of events) {
    const outcome = await deps.inbox.apply(event, now);
    if (outcome === "applied") result.applied += 1;
    else if (outcome === "stale") result.stale += 1;
    else result.waitingForStore += 1;
  }

  return result;
}
