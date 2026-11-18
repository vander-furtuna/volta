/**
 * Ports used by application use cases. Infrastructure (src/server) provides the adapters,
 * which keeps use cases testable with in-memory fakes.
 */

export interface StoredWebhookEvent {
  source: "cw_orders" | "cw_billing";
  eventId: string;
  eventType: string;
  storeExternalId: number | null;
  payload: unknown;
  receivedAt: Date;
}

export interface WebhookEventStore {
  /** Persists the event once. Returns false when the event id was already stored (a retry). */
  saveIfNew(event: StoredWebhookEvent): Promise<boolean>;
}

export interface SyncJobQueue {
  enqueue(job: {
    type: "fetch_order_details";
    storeExternalId: number;
    orderId: number;
  }): Promise<void>;
}
