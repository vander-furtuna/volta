import { describe, expect, it } from "vitest";
import { campaignResultWindow, summarizeStoredCampaign } from "./stored-campaign-results";

const window = campaignResultWindow("2026-11-20", "2026-11-23", null)!;
const order = {
  id: 10,
  customerId: 3,
  outcome: "completed" as const,
  total: 45,
  placedAt: new Date("2026-11-22T02:30:00Z"),
  syncedAt: new Date("2026-11-22T03:20:00Z"),
  channel: "menu",
  discounts: [
    { category: "coupon" as const, couponId: 7, amount: 5, sponsor: "merchant" as const },
  ],
};

describe("campaignResultWindow", () => {
  it("starts at the local midnight and covers seven additional local days by default", () => {
    expect(window.startsAt.toISOString()).toBe("2026-11-20T03:00:00.000Z");
    expect(window.followUpEndsAt.toISOString()).toBe("2026-12-01T02:59:59.999Z");
  });

  it("uses the stored tracking deadline and rejects an inverted window", () => {
    const deadline = new Date("2026-11-25T00:00:00Z");
    expect(campaignResultWindow("2026-11-20", "2026-11-23", deadline)?.followUpEndsAt).toEqual(
      deadline,
    );
    expect(campaignResultWindow("2026-11-24", "2026-11-23", null)).toBeNull();
  });
});

describe("summarizeStoredCampaign", () => {
  it("only reports observed return after the manager marks invitations as sent", () => {
    const input = { ...window, couponId: 7, invitedCustomerIds: new Set([3, 4]), orders: [order] };
    expect(summarizeStoredCampaign(input, false).observedReturn).toBeNull();
    expect(summarizeStoredCampaign(input, true).observedReturn).toEqual({
      invited: 2,
      returnedWithCoupon: 1,
      returnedWithoutCoupon: 0,
      noIdentifiedOrder: 1,
    });
  });

  it("keeps coupon use, canceled exclusions and order freshness tied to the stored snapshots", () => {
    const canceled = {
      ...order,
      id: 11,
      outcome: "canceled" as const,
      syncedAt: new Date("2026-11-23"),
    };
    const open = { ...order, id: 12, outcome: "open" as const };
    const outside = { ...order, id: 13, placedAt: new Date("2026-12-01T03:00:00Z") };
    const result = summarizeStoredCampaign(
      {
        ...window,
        couponId: 7,
        invitedCustomerIds: new Set([3]),
        orders: [order, canceled, open, outside],
      },
      true,
    );
    expect(result.usage).toEqual({
      orders: 1,
      merchantDiscount: 5,
      orderValue: 45,
      canceledOrdersExcluded: 1,
    });
    expect(result.couponOrders.map(({ id }) => id)).toEqual([10, 11]);
    expect(result.lastSyncAt).toEqual(canceled.syncedAt);
  });
});
