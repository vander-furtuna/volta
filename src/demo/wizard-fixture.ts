import type { AudienceCriteria, CustomerSummary } from "@/domain/audience/audience";
import type { Offer, OfferContext } from "@/domain/offer/offer";
import { MS_PER_DAY } from "@/domain/shared/time";

/**
 * Synthetic data for the campaign wizard (audience, offer, review) in demo mode.
 * The customer list is built so that `buildAudience` with the default criteria gives exactly the
 * numbers in the design templates: 214 frequent, 162 recent, 52 in the opportunity, 6 + 3 + 5
 * excluded and 38 in the audience.
 */

/** "Now" for the demo: the audience was frozen today at 19:31. */
export const DEMO_NOW = new Date("2026-11-16T19:31:00-03:00");

export const DEMO_CAMPAIGN = {
  name: "Volta de novembro",
  audienceSavedAt: "19:31",
  offerSavedAt: "19:33",
  reviewSavedAt: "19:36",
} as const;

export const DEFAULT_CRITERIA: AudienceCriteria = {
  minCompletedOrders: 3,
  minDaysSinceLastOrder: 30,
  minDaysBetweenInvitations: 14,
};

/**
 * Frequent customers per 3-day bucket of "days since last order" (bucket i = days 3i..3i+2).
 * Also drives the dot chart on the home screen. Buckets 0–9 ordered in the last 30 days.
 */
export const DAYS_SINCE_LAST_ORDER_BUCKETS: readonly number[] = [
  14, 20, 22, 21, 19, 18, 16, 13, 11, 8, 6, 6, 5, 4, 4, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 0,
  1, 0, 1, 0, 0, 1,
];
export const BUCKET_DAYS = 3;
export const CRITERIA_BUCKET = DEFAULT_CRITERIA.minDaysSinceLastOrder / BUCKET_DAYS;

export interface SampleCustomer extends CustomerSummary {
  /** Median days between this customer's orders ("costuma pedir a cada") */
  typicalIntervalDays: number;
  /** Shown in the shorter mobile list */
  showOnMobile: boolean;
}

/** How many customers of the list are shown before "Ver os N clientes" (template sample). */
export const SAMPLE_SIZE = 8;

function daysAgo(days: number): Date {
  return new Date(DEMO_NOW.getTime() - days * MS_PER_DAY);
}

const INVITED_ON = new Date("2026-11-09T12:00:00-03:00");

type SampleSeed = [
  name: string,
  orders: number,
  days: number,
  interval: number,
  situation: "in" | "whatsapp" | "phone" | "invited",
  mobile: boolean,
];

const SAMPLE_SEEDS: SampleSeed[] = [
  ["Carla F.", 12, 38, 6, "in", true],
  ["Ana Paula R.", 7, 41, 9, "in", true],
  ["Bruno M.", 4, 33, 15, "in", false],
  ["Elaine T.", 5, 47, 12, "whatsapp", true],
  ["Diego S.", 3, 64, 21, "in", true],
  ["Fábio L.", 6, 35, 10, "invited", true],
  ["Gabriela N.", 3, 92, 30, "in", false],
  ["Hugo P.", 4, 52, 18, "phone", true],
];

function customer(
  id: number,
  name: string,
  completedOrders: number,
  days: number,
  situation: SampleSeed[4],
): CustomerSummary {
  return {
    id,
    name,
    phone: situation === "phone" ? null : `+55859${String(id).padStart(8, "0")}`,
    allowsWhatsapp: situation !== "whatsapp",
    completedOrders,
    lastOrderAt: daysAgo(days),
    lastInvitedAt: situation === "invited" ? INVITED_ON : null,
  };
}

export const SAMPLE_CUSTOMERS: SampleCustomer[] = SAMPLE_SEEDS.map(
  ([name, orders, days, interval, situation, mobile], index) => ({
    ...customer(index + 1, name, orders, days, situation),
    typicalIntervalDays: interval,
    showOnMobile: mobile,
  }),
);

/** Exclusions still to distribute among generated opportunity customers (samples already count). */
const EXTRA_EXCLUSIONS: SampleSeed[4][] = [
  "whatsapp",
  "invited",
  "whatsapp",
  "phone",
  "invited",
  "whatsapp",
  "invited",
  "phone",
  "whatsapp",
  "invited",
  "whatsapp",
];

const FIRST_NAMES = [
  "Rafael",
  "Juliana",
  "Marcos",
  "Patrícia",
  "Thiago",
  "Larissa",
  "André",
  "Camila",
  "Felipe",
  "Renata",
  "Lucas",
  "Beatriz",
  "Rodrigo",
  "Mariana",
  "Gustavo",
  "Aline",
  "Vinícius",
  "Tatiane",
  "Eduardo",
  "Priscila",
  "Leonardo",
  "Natália",
  "Paulo",
  "Vanessa",
];
const INITIALS = "ABCDFGLMNPRST";

function demoName(id: number): string {
  const first = FIRST_NAMES[id % FIRST_NAMES.length] ?? "Cliente";
  const initial = INITIALS[(id * 5) % INITIALS.length] ?? "S";
  return `${first} ${initial}.`;
}

function buildDemoCustomers(): SampleCustomer[] {
  const remaining = [...DAYS_SINCE_LAST_ORDER_BUCKETS];
  for (const sample of SAMPLE_SEEDS) {
    const bucket = Math.floor(sample[2] / BUCKET_DAYS);
    remaining[bucket] = (remaining[bucket] ?? 0) - 1;
  }

  const generated: SampleCustomer[] = [];
  let opportunityIndex = 0;
  remaining.forEach((count, bucket) => {
    for (let k = 0; k < count; k++) {
      const id = SAMPLE_SEEDS.length + generated.length + 1;
      const days = bucket * BUCKET_DAYS + 1 + (k % 2);
      const orders = 3 + ((id * 7) % 8);
      let situation: SampleSeed[4] = "in";
      if (days > DEFAULT_CRITERIA.minDaysSinceLastOrder) {
        situation = EXTRA_EXCLUSIONS[opportunityIndex] ?? "in";
        opportunityIndex++;
      }
      generated.push({
        ...customer(id, demoName(id), orders, days, situation),
        typicalIntervalDays: 5 + ((id * 3) % 20),
        showOnMobile: false,
      });
    }
  });
  return [...SAMPLE_CUSTOMERS, ...generated];
}

/** All frequent demo customers. The first 8 are the sample shown in the templates. */
export const DEMO_CUSTOMERS: SampleCustomer[] = buildDemoCustomers();

export const DEMO_OFFER_CONTEXT: OfferContext = {
  audienceAverageOrderValue: 74,
  averageDeliveryFee: 7,
};

export const DEMO_OFFER: Offer = {
  benefit: "fixed_amount",
  amount: 10,
  minimumOrderValue: 60,
  usageLimit: 20,
  oncePerCustomer: true,
  newCustomersOnly: false,
  couponCode: "VOLTA10",
  channels: ["delivery", "takeout"],
  startsOn: "2026-11-18",
  endsOn: "2026-11-23",
};

export const DEMO_AUDIENCE_SIZE = 38;
