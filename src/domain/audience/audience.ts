import { daysBetween, median } from "@/domain/shared/time";

/**
 * Builds the audience of a repurchase campaign from identified customers.
 * This is an explainable heuristic, not a churn prediction: the criteria are shown on screen.
 */

export interface CustomerSummary {
  id: number;
  name: string;
  phone: string | null;
  /** CW `notifications_enabled`: the customer allows WhatsApp messages */
  allowsWhatsapp: boolean;
  /** Completed orders inside the criteria window */
  completedOrders: number;
  lastOrderAt: Date;
  /** Last invitation recorded by Volta */
  lastInvitedAt: Date | null;
}

export interface AudienceCriteria {
  minCompletedOrders: number;
  minDaysSinceLastOrder: number;
  /** Minimum gap between two Volta invitations to the same person */
  minDaysBetweenInvitations: number;
}

export type ExclusionReason = "whatsapp_not_allowed" | "missing_phone" | "recently_invited";

export const EXCLUSION_ORDER: readonly ExclusionReason[] = [
  "whatsapp_not_allowed",
  "missing_phone",
  "recently_invited",
];

export interface AudienceBreakdown {
  frequentCustomers: number;
  orderedRecently: number;
  opportunity: number;
  exclusions: { reason: ExclusionReason; count: number }[];
  included: CustomerSummary[];
  excluded: { customer: CustomerSummary; reason: ExclusionReason }[];
}

function exclusionReason(
  customer: CustomerSummary,
  criteria: AudienceCriteria,
  now: Date,
): ExclusionReason | null {
  if (!customer.allowsWhatsapp) return "whatsapp_not_allowed";
  if (!customer.phone) return "missing_phone";
  if (
    customer.lastInvitedAt &&
    daysBetween(customer.lastInvitedAt, now) < criteria.minDaysBetweenInvitations
  ) {
    return "recently_invited";
  }
  return null;
}

export function buildAudience(
  customers: readonly CustomerSummary[],
  criteria: AudienceCriteria,
  now: Date = new Date(),
): AudienceBreakdown {
  const frequent = customers.filter((c) => c.completedOrders >= criteria.minCompletedOrders);
  const opportunity = frequent.filter(
    (c) => daysBetween(c.lastOrderAt, now) > criteria.minDaysSinceLastOrder,
  );

  const included: CustomerSummary[] = [];
  const excluded: AudienceBreakdown["excluded"] = [];
  for (const customer of opportunity) {
    const reason = exclusionReason(customer, criteria, now);
    if (reason) excluded.push({ customer, reason });
    else included.push(customer);
  }

  return {
    frequentCustomers: frequent.length,
    orderedRecently: frequent.length - opportunity.length,
    opportunity: opportunity.length,
    exclusions: EXCLUSION_ORDER.map((reason) => ({
      reason,
      count: excluded.filter((entry) => entry.reason === reason).length,
    })),
    included,
    excluded,
  };
}

/** Median days between consecutive orders ("costuma pedir a cada"). null with fewer than 2 orders. */
export function typicalOrderIntervalDays(orderDates: readonly Date[]): number | null {
  const sorted = [...orderDates].sort((a, b) => a.getTime() - b.getTime());
  const gaps = sorted.slice(1).map((date, index) => daysBetween(sorted[index] as Date, date));
  const result = median(gaps);
  return result === null ? null : Math.round(result);
}
