import type { IncomingOrderEvent, OrderWebhookInbox } from "@/application/ports";

/**
 * Handles a validated CW order webhook. Must stay fast: CW expects a 200 within 5 seconds,
 * so the order details are fetched later by the sync worker.
 *
 * Storing and scheduling happen inside the inbox, atomically. Errors are not caught here:
 * a failure must reach the route, which answers 503 so CW retries the event.
 */
export async function receiveOrderEvent(
  event: IncomingOrderEvent,
  deps: { inbox: OrderWebhookInbox },
): Promise<{ duplicate: boolean }> {
  const isNew = await deps.inbox.receive(event);
  return { duplicate: !isNew };
}
