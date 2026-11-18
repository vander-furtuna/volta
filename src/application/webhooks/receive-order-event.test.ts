import { describe, expect, it } from "vitest";
import type { StoredWebhookEvent, SyncJobQueue, WebhookEventStore } from "@/application/ports";
import { receiveOrderEvent } from "./receive-order-event";

function inMemoryDeps() {
  const stored = new Map<string, StoredWebhookEvent>();
  const jobs: Parameters<SyncJobQueue["enqueue"]>[0][] = [];
  const events: WebhookEventStore = {
    async saveIfNew(event) {
      if (stored.has(event.eventId)) return false;
      stored.set(event.eventId, event);
      return true;
    },
  };
  const queue: SyncJobQueue = {
    async enqueue(job) {
      jobs.push(job);
    },
  };
  return { events, queue, jobs };
}

const event = {
  event_id: "evt_1",
  event_type: "ORDER_STATUS_UPDATED" as const,
  merchant_id: 123,
  order_id: 90412,
  order_status: "canceled",
  created_at: "2026-11-17T22:00:00Z",
};

describe("receiveOrderEvent", () => {
  it("stores the event and schedules a details fetch", async () => {
    const deps = inMemoryDeps();
    await expect(receiveOrderEvent(event, deps)).resolves.toEqual({ duplicate: false });
    expect(deps.jobs).toEqual([
      { type: "fetch_order_details", storeExternalId: 123, orderId: 90412 },
    ]);
  });

  it("ignores CW retries of the same event", async () => {
    const deps = inMemoryDeps();
    await receiveOrderEvent(event, deps);
    await expect(receiveOrderEvent(event, deps)).resolves.toEqual({ duplicate: true });
    expect(deps.jobs).toHaveLength(1);
  });
});
