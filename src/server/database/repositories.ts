import "server-only";
import type { StoredWebhookEvent, SyncJobQueue, WebhookEventStore } from "@/application/ports";
import { getServiceClient } from "./supabase";

const UNIQUE_VIOLATION = "23505";

export const supabaseWebhookEventStore: WebhookEventStore = {
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

export const supabaseSyncJobQueue: SyncJobQueue = {
  async enqueue(job) {
    const { error } = await getServiceClient()
      .from("sync_jobs")
      .insert({
        job_type: job.type,
        store_external_id: job.storeExternalId,
        payload: { orderId: job.orderId },
      });
    if (error) throw error;
  },
};
