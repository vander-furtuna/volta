import "server-only";
import type {
  BillingEventStore,
  IncomingOrderEvent,
  OrderWebhookInbox,
  StoredWebhookEvent,
} from "@/application/ports";
import { getServiceClient } from "./supabase";

const UNIQUE_VIOLATION = "23505";

export const supabaseBillingEventStore: BillingEventStore = {
  async saveIfNew(event: StoredWebhookEvent) {
    const { error } = await getServiceClient().from("webhook_events").insert({
      source: event.source,
      event_id: event.eventId,
      event_type: event.eventType,
      store_external_id: event.storeExternalId,
      payload: event.payload,
      received_at: event.receivedAt.toISOString(),
    });
    if (error?.code === UNIQUE_VIOLATION) return false;
    if (error) throw error;
    return true;
  },
};

/** Calls the receive_order_webhook RPC, which stores the event and its job in one transaction. */
export const supabaseOrderWebhookInbox: OrderWebhookInbox = {
  async receive(event: IncomingOrderEvent) {
    const { data, error } = await getServiceClient().rpc("receive_order_webhook", {
      p_event_id: event.eventId,
      p_event_type: event.eventType,
      p_store_external_id: event.storeExternalId,
      p_order_id: event.orderId,
      p_payload: event.payload,
      p_received_at: event.receivedAt.toISOString(),
    });
    if (error) throw error;
    if (typeof data !== "boolean") {
      throw new Error("receive_order_webhook returned an unexpected value");
    }
    return data;
  },
};
