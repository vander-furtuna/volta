import { describe, expect, it } from "vitest";
import {
  computeCampaignResults,
  identificationCoverage,
  type OrderSummary,
} from "./campaign-results";

const COUPON_ID = 47960;
const startsAt = new Date("2026-10-27T00:00:00-03:00");
const followUpEndsAt = new Date("2026-11-09T23:59:59-03:00");
const at = (day: string) => new Date(`${day}T20:00:00-03:00`);

function order(overrides: Partial<OrderSummary> & { id: number }): OrderSummary {
  return {
    customerId: 1,
    outcome: "completed",
    total: 80,
    placedAt: at("2026-10-30"),
    channel: "menu",
    discounts: [{ category: "coupon", couponId: COUPON_ID, amount: 10, sponsor: "merchant" }],
    ...overrides,
  };
}

describe("computeCampaignResults", () => {
  const results = computeCampaignResults({
    couponId: COUPON_ID,
    invitedCustomerIds: new Set([1, 2, 3, 4]),
    startsAt,
    followUpEndsAt,
    orders: [
      order({ id: 1, customerId: 1 }),
      order({ id: 2, customerId: 2, discounts: [] }),
      order({ id: 3, customerId: 9 }),
      order({ id: 4, customerId: null }),
      order({ id: 5, customerId: 3, outcome: "canceled" }),
      order({ id: 6, customerId: 4, placedAt: at("2026-10-01") }),
    ],
  });

  it("counts coupon usage only on completed orders inside the window", () => {
    expect(results.usage).toEqual({
      orders: 3,
      merchantDiscount: 30,
      orderValue: 240,
      canceledOrdersExcluded: 1,
    });
  });

  it("separates customers who returned with and without the coupon", () => {
    expect(results.observedReturn).toEqual({
      invited: 4,
      returnedWithCoupon: 1,
      returnedWithoutCoupon: 1,
      noIdentifiedOrder: 2,
    });
  });

  it("reports coupon leakage outside the invited list", () => {
    expect(results.leakage).toEqual({ ordersFromNonInvited: 1, ordersWithoutCustomer: 1 });
  });

  it("does not count iFood-sponsored discounts as merchant cost", () => {
    const ifood = computeCampaignResults({
      couponId: COUPON_ID,
      invitedCustomerIds: new Set([1]),
      startsAt,
      followUpEndsAt,
      orders: [
        order({
          id: 1,
          discounts: [{ category: "coupon", couponId: COUPON_ID, amount: 10, sponsor: "ifood" }],
        }),
      ],
    });
    expect(ifood.usage.merchantDiscount).toBe(0);
  });
});

describe("identificationCoverage", () => {
  it("returns the identified share per channel", () => {
    const coverage = identificationCoverage([
      order({ id: 1, channel: "menu" }),
      order({ id: 2, channel: "counter", customerId: null }),
      order({ id: 3, channel: "counter" }),
    ]);
    expect(coverage.get("menu")).toBe(1);
    expect(coverage.get("counter")).toBe(0.5);
  });
});
