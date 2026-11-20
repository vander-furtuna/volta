import { computeCampaignResults } from "@/domain/metrics/campaign-results";
import {
  DEMO_CLOSED_CAMPAIGN as campaign,
  DEMO_CLOSED_CAMPAIGN_ORDERS as orders,
  DEMO_CUSTOMER_NAMES,
} from "@/demo/campaign-fixture";

/**
 * View model for the results screen: every number comes from computeCampaignResults over the
 * demo orders; this file only formats.
 */

export type ReturnTag = "invited" | "outside" | "canceled";

export type CouponOrderRow = {
  number: number;
  date: string;
  customer: string | null;
  feminine: boolean;
  channel: string;
  discount: string;
  total: string;
  tag: ReturnTag;
};

const WEEKDAY = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
const MONTH = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "mai.",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
];
const TIME_ZONE = "America/Sao_Paulo";

const brl = (value: number, decimals = 2) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

/** Calendar date (YYYY-MM-DD) of an instant in the store's time zone. */
function localIsoDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}

function shortDate(date: Date) {
  const [y = 0, m = 1, d = 1] = localIsoDate(date).split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAY[weekday]}, ${d} ${MONTH[m - 1]}`;
}

const results = computeCampaignResults({
  couponId: campaign.couponId,
  invitedCustomerIds: campaign.invitedCustomerIds,
  startsAt: campaign.startsAt,
  followUpEndsAt: campaign.followUpEndsAt,
  orders,
});

const usesCoupon = (order: (typeof orders)[number]) =>
  order.discounts.some((d) => d.category === "coupon" && d.couponId === campaign.couponId);

const couponOrders = orders
  .filter(usesCoupon)
  .sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime());

const rows: CouponOrderRow[] = couponOrders.map((order) => {
  const person = order.customerId === null ? null : DEMO_CUSTOMER_NAMES[order.customerId];
  const invited = order.customerId !== null && campaign.invitedCustomerIds.has(order.customerId);
  const discount = order.discounts
    .filter((d) => d.couponId === campaign.couponId)
    .reduce((sum, d) => sum + d.amount, 0);
  return {
    number: order.id,
    date: shortDate(order.placedAt),
    customer: person?.name ?? null,
    feminine: person?.feminine ?? false,
    channel: order.channel,
    discount: brl(discount),
    total: brl(order.total),
    tag: order.outcome === "canceled" ? "canceled" : invited ? "invited" : "outside",
  };
});

const pick = (ids: readonly number[]) =>
  ids.map((id) => rows.find((row) => row.number === id)).filter((row) => row !== undefined);

const completedCouponOrders = couponOrders.filter((o) => o.outcome === "completed");
const { usage, observedReturn, leakage } = results;
const returned = observedReturn.returnedWithCoupon + observedReturn.returnedWithoutCoupon;

export const RESULTS = {
  name: campaign.name,
  couponCode: campaign.couponCode,
  cwCouponNumber: campaign.couponId,
  maxUses: campaign.maxUses,
  discountCeiling: campaign.discountCeiling,
  // Measured
  couponOrders: usage.orders,
  discountGiven: usage.merchantDiscount,
  ordersValue: brl(Math.round(usage.orderValue), 0),
  ordersValueExact: brl(usage.orderValue),
  canceledExcluded: usage.canceledOrdersExcluded,
  usePct: Math.round((usage.orders / campaign.maxUses) * 100),
  discountPct: Math.round((usage.merchantDiscount / campaign.discountCeiling) * 100),
  // Observed
  invited: observedReturn.invited,
  returned,
  returnPct: Math.round((returned / observedReturn.invited) * 100),
  returnedWithCoupon: observedReturn.returnedWithCoupon,
  returnedWithoutCoupon: observedReturn.returnedWithoutCoupon,
  noIdentifiedOrder: observedReturn.noIdentifiedOrder,
  ordersFromNonInvited: leakage.ordersFromNonInvited,
  ordersWithoutCustomer: leakage.ordersWithoutCustomer,
  // Lists and chart
  totalOrdersListed: rows.length,
  allOrders: rows,
  desktopOrders: pick(campaign.desktopOrderIds),
  mobileOrders: pick(campaign.mobileOrderIds),
  usesPerDay: campaign.couponDays.map((day) => ({
    ...day,
    count: completedCouponOrders.filter((o) => localIsoDate(o.placedAt) === day.iso).length,
  })),
};
