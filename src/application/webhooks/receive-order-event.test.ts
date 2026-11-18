import { describe, expect, it } from "vitest";
import type { IncomingOrderEvent, OrderWebhookInbox } from "@/application/ports";
import { receiveOrderEvent } from "./receive-order-event";

interface ScheduledFetch {
  storeExternalId: number;
  orderId: number;
}

/**
 * In-memory inbox that behaves like the atomic RPC: the event and its job are recorded together,
 * or not at all. `failNext` simulates a storage outage.
 */
function inMemoryInbox() {
  const events = new Map<string, IncomingOrderEvent>();
  const jobs: ScheduledFetch[] = [];
  let failNext = false;

  const inbox: OrderWebhookInbox = {
    async receive(event) {
      if (failNext) {
        failNext = false;
        throw new Error("storage unavailable");
      }
      if (events.has(event.eventId)) return false;
      events.set(event.eventId, event);
      jobs.push({ storeExternalId: event.storeExternalId, orderId: event.orderId });
      return true;
    },
  };

  return {
    inbox,
    jobs,
    events,
    failNextWrite() {
      failNext = true;
    },
  };
}

const incoming: IncomingOrderEvent = {
  eventId: "evt_1",
  eventType: "ORDER_STATUS_UPDATED",
  storeExternalId: 123,
  orderId: 90412,
  payload: { event_id: "evt_1", order_id: 90412, merchant_id: 123 },
  receivedAt: new Date("2026-11-17T22:00:00Z"),
};

describe("receiveOrderEvent", () => {
  it("stores the event and schedules a details fetch for its order", async () => {
    const deps = inMemoryInbox();
    await expect(receiveOrderEvent(incoming, deps)).resolves.toEqual({ duplicate: false });
    expect(deps.jobs).toEqual([{ storeExternalId: 123, orderId: 90412 }]);
    expect(deps.events.has("evt_1")).toBe(true);
  });

  it("ignores CW retries of the same event without scheduling again", async () => {
    const deps = inMemoryInbox();
    await receiveOrderEvent(incoming, deps);
    await expect(receiveOrderEvent(incoming, deps)).resolves.toEqual({ duplicate: true });
    expect(deps.jobs).toHaveLength(1);
  });

  it("propagates storage failures so CW retries, and records nothing", async () => {
    const deps = inMemoryInbox();
    deps.failNextWrite();
    await expect(receiveOrderEvent(incoming, deps)).rejects.toThrow("storage unavailable");
    expect(deps.jobs).toHaveLength(0);
    expect(deps.events.size).toBe(0);

    // The retry that CW sends afterwards is treated as a new event and processed normally.
    await expect(receiveOrderEvent(incoming, deps)).resolves.toEqual({ duplicate: false });
    expect(deps.jobs).toHaveLength(1);
  });
});
