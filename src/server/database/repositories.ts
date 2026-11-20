import "server-only";
import { z } from "zod";
import type {
  AccessEventInbox,
  BillingEventStore,
  IncomingOrderEvent,
  OrderWebhookInbox,
  PendingAccessEvent,
  StoredWebhookEvent,
} from "@/application/ports";
import {
  ACCESS_UPDATED_EVENT,
  SUPPORTED_ACCESS_EVENT_VERSION,
  accessUpdatedEventSchema,
} from "@/integrations/cardapio-web/webhooks";
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

const pendingAccessRowSchema = z.object({
  id: z.number().int(),
  payload: z.unknown(),
});

const accessOutcomeSchema = z.enum(["applied", "stale", "store_unknown"]);

/**
 * Access events stored by the billing webhook. The route already validated them with the same
 * schema; a row that no longer parses is skipped here and stays in the inbox for inspection.
 */
export const supabaseAccessEventInbox: AccessEventInbox = {
  async listPending(limit) {
    const { data, error } = await getServiceClient()
      .from("webhook_events")
      .select("id, payload")
      .eq("source", "cw_billing")
      .eq("event_type", ACCESS_UPDATED_EVENT)
      .eq("payload->>version", String(SUPPORTED_ACCESS_EVENT_VERSION))
      .is("processed_at", null)
      .order("received_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit);
    if (error) throw error;

    const events: PendingAccessEvent[] = [];
    for (const row of z.array(pendingAccessRowSchema).parse(data ?? [])) {
      const parsed = accessUpdatedEventSchema.safeParse(row.payload);
      if (!parsed.success) continue;
      const event = parsed.data;
      events.push({
        rowId: row.id,
        storeExternalId: event.company_id,
        installationExternalId: event.installation_id,
        sequence: event.sequence,
        occurredAt: new Date(event.occurred_at),
        allowed: event.entitlement.allowed,
        reason: event.entitlement.reason,
        accessUntil:
          event.entitlement.access_until === null ? null : new Date(event.entitlement.access_until),
      });
    }
    return events;
  },

  async apply(event, now) {
    const { data, error } = await getServiceClient().rpc("apply_store_access_event", {
      p_event_row_id: event.rowId,
      p_store_external_id: event.storeExternalId,
      p_installation_external_id: event.installationExternalId,
      p_sequence: event.sequence,
      p_occurred_at: event.occurredAt.toISOString(),
      p_allowed: event.allowed,
      p_reason: event.reason,
      p_access_until: event.accessUntil?.toISOString() ?? null,
      p_now: now.toISOString(),
    });
    if (error) throw error;
    return accessOutcomeSchema.parse(data);
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
