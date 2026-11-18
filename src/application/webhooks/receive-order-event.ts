import type { OrderWebhookEvent } from "@/integrations/cardapio-web/webhooks";
import type { SyncJobQueue, WebhookEventStore } from "@/application/ports";

/**
 * Handles a validated CW order webhook. Must stay fast: CW expects a 200 within 5 seconds,
 * so the order details are fetched later by the sync worker.
 */
export async function receiveOrderEvent(
  event: OrderWebhookEvent,
  deps: { events: WebhookEventStore; queue: SyncJobQueue; now?: Date },
): Promise<{ duplicate: boolean }> {
  const isNew = await deps.events.saveIfNew({
    source: "cw_orders",
    eventId: event.event_id,
    eventType: event.event_type,
    storeExternalId: event.merchant_id,
    payload: event,
    receivedAt: deps.now ?? new Date(),
  });
  if (!isNew) return { duplicate: true };

  await deps.queue.enqueue({
    type: "fetch_order_details",
    storeExternalId: event.merchant_id,
    orderId: event.order_id,
  });
  return { duplicate: false };
}
