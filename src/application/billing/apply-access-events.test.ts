import { describe, expect, it } from "vitest";
import type { AccessEventInbox, AccessEventOutcome, PendingAccessEvent } from "@/application/ports";
import { applyAccessEvents } from "./apply-access-events";

const now = new Date("2026-11-20T12:00:00Z");

function accessEvent(overrides: Partial<PendingAccessEvent> = {}): PendingAccessEvent {
  return {
    rowId: 1,
    storeExternalId: 100,
    installationExternalId: 500,
    sequence: 8,
    occurredAt: new Date("2026-11-20T11:59:00Z"),
    allowed: true,
    reason: null,
    accessUntil: null,
    ...overrides,
  };
}

function fakeInbox(events: PendingAccessEvent[], outcomes: AccessEventOutcome[]) {
  const applied: PendingAccessEvent[] = [];
  const limits: number[] = [];
  const inbox: AccessEventInbox = {
    async listPending(limit) {
      limits.push(limit);
      return events;
    },
    async apply(event, appliedAt) {
      expect(appliedAt).toBe(now);
      applied.push(event);
      const outcome = outcomes[applied.length - 1];
      if (!outcome) throw new Error("unexpected apply");
      return outcome;
    },
  };
  return { inbox, applied, limits };
}

describe("applyAccessEvents", () => {
  it("applies every pending event in the order the inbox returns them", async () => {
    const events = [accessEvent({ rowId: 1 }), accessEvent({ rowId: 2, sequence: 9 })];
    const { inbox, applied } = fakeInbox(events, ["applied", "applied"]);

    await expect(applyAccessEvents(now, { inbox })).resolves.toEqual({
      applied: 2,
      stale: 0,
      waitingForStore: 0,
    });
    expect(applied.map((event) => event.rowId)).toEqual([1, 2]);
  });

  it("counts stale snapshots and events whose store is not installed yet", async () => {
    const events = [
      accessEvent({ rowId: 1 }),
      accessEvent({ rowId: 2 }),
      accessEvent({ rowId: 3 }),
    ];
    const { inbox } = fakeInbox(events, ["applied", "stale", "store_unknown"]);

    await expect(applyAccessEvents(now, { inbox })).resolves.toEqual({
      applied: 1,
      stale: 1,
      waitingForStore: 1,
    });
  });

  it("reads a bounded batch so one run stays short", async () => {
    const { inbox, limits } = fakeInbox([], []);
    await applyAccessEvents(now, { inbox, batchSize: 5 });
    await applyAccessEvents(now, { inbox });
    expect(limits).toEqual([5, 50]);
  });

  it("lets a storage error propagate, leaving the event pending for the next run", async () => {
    const inbox: AccessEventInbox = {
      listPending: async () => [accessEvent()],
      apply: async () => {
        throw new Error("database unavailable");
      },
    };
    await expect(applyAccessEvents(now, { inbox })).rejects.toThrow("database unavailable");
  });
});
