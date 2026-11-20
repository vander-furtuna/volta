import type { OrderSummary } from "@/domain/metrics/campaign-results";

/**
 * Demo data for the closed "Volta de outubro" campaign (results screen). The raw orders below
 * feed computeCampaignResults and reproduce the numbers in design/templates/source/results.dc.html:
 * 14 completed coupon orders (R$ 140 in discounts, R$ 1.218,40 paid), 1 canceled,
 * 14 of 40 invited came back (11 with the coupon, 3 without), 2 uses outside the list and
 * 1 without an identified customer.
 *
 * The new campaign ("Volta de novembro") is driven by src/demo/campaign-draft.ts.
 */

export const DEMO_NEW_CAMPAIGN_ID = "nov";

/** Number of the coupon created on CW in demo mode (see createDemoCoupon). */
export const DEMO_NEW_COUPON_NUMBER = 48213;

export const DEMO_NEW_CAMPAIGN_TIMES = {
  audienceFrozenAt: "19:31",
  couponCreatedAt: "19:38",
  activatedAt: "19:40",
  invitationsMarkedAt: "19:42",
} as const;

export const DEMO_CLOSED_CAMPAIGN = {
  id: "out",
  name: "Volta de outubro",
  couponCode: "VOLTA10",
  couponId: 47960,
  maxUses: 20,
  discountCeiling: 200,
  startsAt: new Date("2026-10-27T00:00:00-03:00"),
  followUpEndsAt: new Date("2026-11-09T23:59:59-03:00"),
  /** The frozen audience: 40 invited customers, ids 1 to 40. */
  invitedCustomerIds: new Set(Array.from({ length: 40 }, (_, index) => index + 1)),
  /** Coupon validity days, in order, for the "uses per day" chart. */
  couponDays: [
    { iso: "2026-10-27", short: "ter", date: "27/10", long: "terça, 27 de outubro" },
    { iso: "2026-10-28", short: "qua", date: "28/10", long: "quarta, 28 de outubro" },
    { iso: "2026-10-29", short: "qui", date: "29/10", long: "quinta, 29 de outubro" },
    { iso: "2026-10-30", short: "sex", date: "30/10", long: "sexta, 30 de outubro" },
    { iso: "2026-10-31", short: "sáb", date: "31/10", long: "sábado, 31 de outubro" },
    { iso: "2026-11-01", short: "dom", date: "1/11", long: "domingo, 1º de novembro" },
    { iso: "2026-11-02", short: "seg", date: "2/11", long: "segunda, 2 de novembro" },
  ],
  /** Orders highlighted in the desktop table and the collapsed mobile list. */
  desktopOrderIds: [90412, 90388, 90377, 90321, 90298, 90270],
  mobileOrderIds: [90412, 90388, 90377, 90270],
};

/** Display names (first name + initial). Customers outside the frozen audience have ids > 100. */
export const DEMO_CUSTOMER_NAMES: Record<number, { name: string; feminine?: boolean }> = {
  1: { name: "Lúcia M.", feminine: true },
  2: { name: "Rafael T." },
  3: { name: "Sônia B.", feminine: true },
  4: { name: "Marcos P." },
  5: { name: "Juliana C.", feminine: true },
  6: { name: "Fernanda L.", feminine: true },
  7: { name: "Diego S." },
  8: { name: "Patrícia N.", feminine: true },
  9: { name: "Bruno A." },
  10: { name: "Camila R.", feminine: true },
  11: { name: "Thiago O." },
  12: { name: "Aline F.", feminine: true },
  13: { name: "Gustavo M." },
  14: { name: "Renata S.", feminine: true },
  15: { name: "Paulo V." },
  101: { name: "Ricardo A." },
  102: { name: "Vanessa D.", feminine: true },
};

const COUPON = DEMO_CLOSED_CAMPAIGN.couponId;

function couponOrder(
  id: number,
  customerId: number | null,
  placedAt: string,
  total: number,
  channel = "Cardápio digital",
  outcome: OrderSummary["outcome"] = "completed",
): OrderSummary {
  return {
    id,
    customerId,
    outcome,
    total,
    placedAt: new Date(`${placedAt}-03:00`),
    channel,
    discounts: [{ category: "coupon", couponId: COUPON, amount: 10, sponsor: "merchant" }],
  };
}

function plainOrder(id: number, customerId: number, placedAt: string, total: number): OrderSummary {
  return {
    id,
    customerId,
    outcome: "completed",
    total,
    placedAt: new Date(`${placedAt}-03:00`),
    channel: "Cardápio digital",
    discounts: [],
  };
}

export const DEMO_CLOSED_CAMPAIGN_ORDERS: OrderSummary[] = [
  // Coupon orders (15, one canceled)
  couponOrder(90270, 15, "2026-10-27T20:05:00", 78, "Cardápio digital", "canceled"),
  couponOrder(90262, 4, "2026-10-27T19:40:00", 95.8),
  couponOrder(90281, 5, "2026-10-28T20:12:00", 88.5),
  couponOrder(90298, 3, "2026-10-29T19:55:00", 92.3),
  couponOrder(90305, 6, "2026-10-29T21:10:00", 102.4),
  couponOrder(90377, null, "2026-10-30T21:30:00", 64, "Balcão"),
  couponOrder(90321, 101, "2026-10-30T19:20:00", 68.4),
  couponOrder(90349, 7, "2026-10-30T20:15:00", 79.9),
  couponOrder(90412, 1, "2026-10-31T21:05:00", 86.9),
  couponOrder(90388, 2, "2026-10-31T20:20:00", 71.5),
  couponOrder(90395, 8, "2026-10-31T20:40:00", 91.2),
  couponOrder(90401, 102, "2026-10-31T20:50:00", 97.6),
  couponOrder(90433, 9, "2026-11-01T19:45:00", 84.3),
  couponOrder(90447, 10, "2026-11-01T20:30:00", 99.7),
  couponOrder(90462, 11, "2026-11-02T20:00:00", 95.9),
  // Invited customers who came back without the coupon
  plainOrder(90418, 12, "2026-10-31T22:10:00", 58.9),
  plainOrder(90490, 13, "2026-11-04T20:25:00", 73.4),
  plainOrder(90533, 14, "2026-11-07T19:50:00", 66),
];
