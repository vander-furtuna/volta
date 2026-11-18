import { describe, expect, it } from "vitest";
import { buildAudience, typicalOrderIntervalDays, type CustomerSummary } from "./audience";

const now = new Date("2026-11-17T12:00:00-03:00");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

function customer(overrides: Partial<CustomerSummary> & { id: number }): CustomerSummary {
  return {
    name: `Cliente ${overrides.id}`,
    phone: "+5585999990000",
    allowsWhatsapp: true,
    completedOrders: 5,
    lastOrderAt: daysAgo(40),
    lastInvitedAt: null,
    ...overrides,
  };
}

const criteria = {
  minCompletedOrders: 3,
  minDaysSinceLastOrder: 30,
  minDaysBetweenInvitations: 14,
};

describe("buildAudience", () => {
  const customers = [
    customer({ id: 1 }),
    customer({ id: 2, lastOrderAt: daysAgo(10) }),
    customer({ id: 3, completedOrders: 2 }),
    customer({ id: 4, allowsWhatsapp: false }),
    customer({ id: 5, phone: null }),
    customer({ id: 6, lastInvitedAt: daysAgo(8) }),
    customer({ id: 7, lastInvitedAt: daysAgo(20) }),
  ];
  const result = buildAudience(customers, criteria, now);

  it("explains every step from frequent customers to the final audience", () => {
    expect(result.frequentCustomers).toBe(6);
    expect(result.orderedRecently).toBe(1);
    expect(result.opportunity).toBe(5);
    expect(result.included.map((c) => c.id)).toEqual([1, 7]);
  });

  it("reports exclusions with their reasons, in display order", () => {
    expect(result.exclusions).toEqual([
      { reason: "whatsapp_not_allowed", count: 1 },
      { reason: "missing_phone", count: 1 },
      { reason: "recently_invited", count: 1 },
    ]);
  });
});

describe("typicalOrderIntervalDays", () => {
  it("returns the median gap between orders", () => {
    expect(typicalOrderIntervalDays([daysAgo(30), daysAgo(20), daysAgo(14), daysAgo(0)])).toBe(10);
  });

  it("returns null with fewer than two orders", () => {
    expect(typicalOrderIntervalDays([daysAgo(3)])).toBeNull();
  });
});
