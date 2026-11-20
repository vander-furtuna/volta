import { typicalOrderIntervalDays, type CustomerSummary } from "@/domain/audience/audience";
import type { OfferContext } from "@/domain/offer/offer";
import { MS_PER_DAY } from "@/domain/shared/time";

/** Default history window considered when building a store's audience (6 months). */
export const AUDIENCE_HISTORY_DAYS = 180;

export interface StoredCustomerRecord {
  externalId: number;
  name: string;
  phone: string | null;
  allowsWhatsapp: boolean;
}

export interface StoredOrderRecord {
  customerExternalId: number | null;
  outcome: "completed" | "canceled" | "open";
  total: number;
  placedAt: Date;
}

export interface StoredInvitationRecord {
  customerExternalId: number;
  invitedAt: Date;
}

export interface StoreCustomerSummary extends CustomerSummary {
  typicalIntervalDays: number | null;
}

/**
 * Aggregates stored customer profiles, synced orders and past campaign invitations into the
 * `CustomerSummary` list consumed by `buildAudience`.
 *
 * Only completed orders with an identified customer inside the lookback window count toward
 * frequency and recency. If a customer appears in identified orders before their profile row is
 * synced, a fallback profile with `phone: null` is used so they are safely excluded as
 * `missing_phone` until synced.
 */
export function summarizeStoreCustomers(input: {
  customers: readonly StoredCustomerRecord[];
  orders: readonly StoredOrderRecord[];
  invitations: readonly StoredInvitationRecord[];
  now?: Date;
  historyDays?: number;
}): StoreCustomerSummary[] {
  const now = input.now ?? new Date();
  const historyDays = input.historyDays ?? AUDIENCE_HISTORY_DAYS;
  const windowStart = new Date(now.getTime() - historyDays * MS_PER_DAY);

  const profileById = new Map<number, StoredCustomerRecord>();
  for (const customer of input.customers) {
    profileById.set(customer.externalId, customer);
  }

  const lastInvitedById = new Map<number, Date>();
  for (const invitation of input.invitations) {
    const existing = lastInvitedById.get(invitation.customerExternalId);
    if (!existing || invitation.invitedAt > existing) {
      lastInvitedById.set(invitation.customerExternalId, invitation.invitedAt);
    }
  }

  const ordersByCustomer = new Map<number, Date[]>();
  for (const order of input.orders) {
    if (
      order.outcome !== "completed" ||
      order.customerExternalId === null ||
      order.placedAt < windowStart ||
      order.placedAt > now
    ) {
      continue;
    }
    const list = ordersByCustomer.get(order.customerExternalId);
    if (list) {
      list.push(order.placedAt);
    } else {
      ordersByCustomer.set(order.customerExternalId, [order.placedAt]);
    }
  }

  const summaries: StoreCustomerSummary[] = [];
  for (const [customerId, dates] of ordersByCustomer.entries()) {
    let lastOrderAt = dates[0] as Date;
    for (const date of dates) {
      if (date > lastOrderAt) lastOrderAt = date;
    }
    const profile = profileById.get(customerId);
    const trimmedPhone = profile?.phone?.trim() ?? "";
    summaries.push({
      id: customerId,
      name: profile?.name.trim() || `Cliente #${customerId}`,
      phone: trimmedPhone === "" ? null : trimmedPhone,
      allowsWhatsapp: profile?.allowsWhatsapp ?? true,
      completedOrders: dates.length,
      lastOrderAt,
      lastInvitedAt: lastInvitedById.get(customerId) ?? null,
      typicalIntervalDays: typicalOrderIntervalDays(dates),
    });
  }

  return summaries.sort((a, b) => b.completedOrders - a.completedOrders || a.id - b.id);
}

/**
 * Computes the `OfferContext` (average order value of the frozen audience) from synced orders.
 * Falls back to the store-wide completed order average when the audience has no synced orders in
 * the window, or 0 when the store has no completed orders yet.
 */
export function computeAudienceOfferContext(
  orders: readonly StoredOrderRecord[],
  audienceCustomerIds: ReadonlySet<number>,
  averageDeliveryFee = 0,
): OfferContext {
  const completed = orders.filter((order) => order.outcome === "completed" && order.total > 0);
  const fromAudience = completed.filter(
    (order) =>
      order.customerExternalId !== null && audienceCustomerIds.has(order.customerExternalId),
  );
  const sample = fromAudience.length > 0 ? fromAudience : completed;
  const average =
    sample.length === 0
      ? 0
      : Math.round((sample.reduce((sum, order) => sum + order.total, 0) / sample.length) * 100) /
        100;

  return {
    audienceAverageOrderValue: average,
    averageDeliveryFee,
  };
}
