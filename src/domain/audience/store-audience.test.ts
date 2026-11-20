import { describe, expect, it } from "vitest";
import { buildAudience } from "./audience";
import {
  computeAudienceOfferContext,
  summarizeStoreCustomers,
  type StoredCustomerRecord,
  type StoredInvitationRecord,
  type StoredOrderRecord,
} from "./store-audience";

const NOW = new Date("2026-11-20T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe("summarizeStoreCustomers", () => {
  const customers: StoredCustomerRecord[] = [
    { externalId: 1, name: "Ana", phone: "85999990001", allowsWhatsapp: true },
    { externalId: 2, name: "Bruno", phone: null, allowsWhatsapp: true },
    { externalId: 3, name: "Carla", phone: "85999990003", allowsWhatsapp: false },
  ];

  const orders: StoredOrderRecord[] = [
    // Ana: 3 completed orders, last 40 days ago (gaps: 10d, 10d -> median 10d)
    { customerExternalId: 1, outcome: "completed", total: 60, placedAt: daysAgo(60) },
    { customerExternalId: 1, outcome: "completed", total: 80, placedAt: daysAgo(50) },
    { customerExternalId: 1, outcome: "completed", total: 70, placedAt: daysAgo(40) },
    // Canceled order and old order outside 180-day window are ignored
    { customerExternalId: 1, outcome: "canceled", total: 100, placedAt: daysAgo(5) },
    { customerExternalId: 1, outcome: "completed", total: 50, placedAt: daysAgo(200) },
    // Bruno: 3 completed orders, last 35 days ago, missing phone
    { customerExternalId: 2, outcome: "completed", total: 50, placedAt: daysAgo(55) },
    { customerExternalId: 2, outcome: "completed", total: 50, placedAt: daysAgo(45) },
    { customerExternalId: 2, outcome: "completed", total: 50, placedAt: daysAgo(35) },
    // Customer 99: present in orders but not yet synced in `customers` table
    { customerExternalId: 99, outcome: "completed", total: 40, placedAt: daysAgo(50) },
    { customerExternalId: 99, outcome: "completed", total: 40, placedAt: daysAgo(45) },
    { customerExternalId: 99, outcome: "completed", total: 40, placedAt: daysAgo(40) },
    // Unidentified order
    { customerExternalId: null, outcome: "completed", total: 30, placedAt: daysAgo(10) },
  ];

  const invitations: StoredInvitationRecord[] = [
    { customerExternalId: 1, invitedAt: daysAgo(30) },
    { customerExternalId: 1, invitedAt: daysAgo(20) },
  ];

  it("aggregates completed orders in the window, intervals, profiles and latest invitation", () => {
    const summaries = summarizeStoreCustomers({
      customers,
      orders,
      invitations,
      now: NOW,
    });

    expect(summaries).toEqual([
      {
        id: 1,
        name: "Ana",
        phone: "85999990001",
        allowsWhatsapp: true,
        completedOrders: 3,
        lastOrderAt: daysAgo(40),
        lastInvitedAt: daysAgo(20),
        typicalIntervalDays: 10,
      },
      {
        id: 2,
        name: "Bruno",
        phone: null,
        allowsWhatsapp: true,
        completedOrders: 3,
        lastOrderAt: daysAgo(35),
        lastInvitedAt: null,
        typicalIntervalDays: 10,
      },
      {
        id: 99,
        name: "Cliente #99",
        phone: null,
        allowsWhatsapp: true,
        completedOrders: 3,
        lastOrderAt: daysAgo(40),
        lastInvitedAt: null,
        typicalIntervalDays: 5,
      },
    ]);

    const audience = buildAudience(
      summaries,
      { minCompletedOrders: 3, minDaysSinceLastOrder: 30, minDaysBetweenInvitations: 14 },
      NOW,
    );
    expect(audience.included.map((c) => c.id)).toEqual([1]);
    expect(audience.excluded.map((e) => ({ id: e.customer.id, reason: e.reason }))).toEqual([
      { id: 2, reason: "missing_phone" },
      { id: 99, reason: "missing_phone" },
    ]);
  });
});

describe("computeAudienceOfferContext", () => {
  const orders: StoredOrderRecord[] = [
    { customerExternalId: 1, outcome: "completed", total: 60, placedAt: NOW },
    { customerExternalId: 1, outcome: "completed", total: 90, placedAt: NOW },
    { customerExternalId: 2, outcome: "completed", total: 30, placedAt: NOW },
    { customerExternalId: 1, outcome: "canceled", total: 500, placedAt: NOW },
  ];

  it("averages completed orders of customers in the frozen audience", () => {
    const context = computeAudienceOfferContext(orders, new Set([1]));
    expect(context).toEqual({
      audienceAverageOrderValue: 75,
      averageDeliveryFee: 0,
    });
  });

  it("falls back to store-wide completed orders when audience has no matching orders", () => {
    const context = computeAudienceOfferContext(orders, new Set([999]), 8);
    expect(context).toEqual({
      audienceAverageOrderValue: 60,
      averageDeliveryFee: 8,
    });
  });
});
