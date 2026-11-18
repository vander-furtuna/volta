/**
 * Campaign results in three layers, from most to least certain:
 *   1. coupon usage    — measured: completed orders whose discount points to the coupon id;
 *   2. observed return — invited customers with any identified completed order in the window;
 *   3. causal effect   — NOT measured here; requires a holdout group.
 * Definitions: docs/product/metrics.md
 */

export type OrderOutcome = "completed" | "canceled";
export type DiscountSponsor = "merchant" | "ifood";

export interface OrderDiscount {
  category: "coupon" | "loyalty" | "other";
  couponId: number | null;
  amount: number;
  sponsor: DiscountSponsor;
}

export interface OrderSummary {
  id: number;
  customerId: number | null;
  outcome: OrderOutcome;
  /** Total paid by the customer, discounts already applied */
  total: number;
  placedAt: Date;
  channel: string;
  discounts: OrderDiscount[];
}

export interface CampaignResultsInput {
  couponId: number;
  invitedCustomerIds: ReadonlySet<number>;
  /** Start of the coupon validity */
  startsAt: Date;
  /** End of the follow-up window (usually coupon end + 7 days) */
  followUpEndsAt: Date;
  orders: readonly OrderSummary[];
}

export interface CampaignResults {
  usage: {
    orders: number;
    merchantDiscount: number;
    orderValue: number;
    canceledOrdersExcluded: number;
  };
  observedReturn: {
    invited: number;
    returnedWithCoupon: number;
    returnedWithoutCoupon: number;
    noIdentifiedOrder: number;
  };
  leakage: {
    ordersFromNonInvited: number;
    ordersWithoutCustomer: number;
  };
}

function usesCoupon(order: OrderSummary, couponId: number): boolean {
  return order.discounts.some((d) => d.category === "coupon" && d.couponId === couponId);
}

function merchantCouponDiscount(order: OrderSummary, couponId: number): number {
  return order.discounts
    .filter((d) => d.category === "coupon" && d.couponId === couponId && d.sponsor === "merchant")
    .reduce((sum, d) => sum + d.amount, 0);
}

export function computeCampaignResults(input: CampaignResultsInput): CampaignResults {
  const inWindow = input.orders.filter(
    (o) => o.placedAt >= input.startsAt && o.placedAt <= input.followUpEndsAt,
  );
  const completed = inWindow.filter((o) => o.outcome === "completed");
  const couponOrders = completed.filter((o) => usesCoupon(o, input.couponId));
  const canceledCouponOrders = inWindow.filter(
    (o) => o.outcome === "canceled" && usesCoupon(o, input.couponId),
  );

  const returnedWithCoupon = new Set<number>();
  const returnedAny = new Set<number>();
  for (const order of completed) {
    if (order.customerId === null || !input.invitedCustomerIds.has(order.customerId)) continue;
    returnedAny.add(order.customerId);
    if (usesCoupon(order, input.couponId)) returnedWithCoupon.add(order.customerId);
  }

  return {
    usage: {
      orders: couponOrders.length,
      merchantDiscount: couponOrders.reduce(
        (s, o) => s + merchantCouponDiscount(o, input.couponId),
        0,
      ),
      orderValue: couponOrders.reduce((s, o) => s + o.total, 0),
      canceledOrdersExcluded: canceledCouponOrders.length,
    },
    observedReturn: {
      invited: input.invitedCustomerIds.size,
      returnedWithCoupon: returnedWithCoupon.size,
      returnedWithoutCoupon: returnedAny.size - returnedWithCoupon.size,
      noIdentifiedOrder: input.invitedCustomerIds.size - returnedAny.size,
    },
    leakage: {
      ordersFromNonInvited: couponOrders.filter(
        (o) => o.customerId !== null && !input.invitedCustomerIds.has(o.customerId),
      ).length,
      ordersWithoutCustomer: couponOrders.filter((o) => o.customerId === null).length,
    },
  };
}

/** Share of orders with an identified customer, per sales channel (0–1). */
export function identificationCoverage(orders: readonly OrderSummary[]): Map<string, number> {
  const totals = new Map<string, { all: number; identified: number }>();
  for (const order of orders) {
    const entry = totals.get(order.channel) ?? { all: 0, identified: 0 };
    entry.all += 1;
    if (order.customerId !== null) entry.identified += 1;
    totals.set(order.channel, entry);
  }
  return new Map([...totals].map(([channel, { all, identified }]) => [channel, identified / all]));
}
