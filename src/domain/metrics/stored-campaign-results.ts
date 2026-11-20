import { MS_PER_DAY } from "@/domain/shared/time";
import {
  computeCampaignResults,
  usesCoupon,
  type CampaignResultsInput,
  type OrderSummary,
} from "./campaign-results";

const DEFAULT_FOLLOW_UP_DAYS = 7;

export function campaignResultWindow(
  startsOn: string,
  endsOn: string,
  storedDeadline: Date | null,
) {
  const startsAt = new Date(`${startsOn}T00:00:00-03:00`);
  const expiresAt = new Date(`${endsOn}T23:59:59.999-03:00`);
  const followUpEndsAt =
    storedDeadline ?? new Date(expiresAt.getTime() + DEFAULT_FOLLOW_UP_DAYS * MS_PER_DAY);
  if (!(startsAt <= expiresAt && expiresAt <= followUpEndsAt)) return null;
  return { startsAt, expiresAt, followUpEndsAt };
}

export type SyncedOrder = Omit<OrderSummary, "outcome"> & {
  outcome: OrderSummary["outcome"] | "open";
  syncedAt: Date;
};

export function summarizeStoredCampaign(
  input: Omit<CampaignResultsInput, "orders"> & { orders: readonly SyncedOrder[] },
  invitationsMarked: boolean,
) {
  const inWindow = input.orders.filter(
    (order) => order.placedAt >= input.startsAt && order.placedAt <= input.followUpEndsAt,
  );
  const finalOrders = inWindow.filter(
    (order): order is SyncedOrder & OrderSummary => order.outcome !== "open",
  );
  const results = computeCampaignResults({ ...input, orders: finalOrders });
  const lastSyncAt = inWindow.reduce<Date | null>(
    (latest, order) => (latest === null || order.syncedAt > latest ? order.syncedAt : latest),
    null,
  );

  return {
    ...results,
    observedReturn: invitationsMarked ? results.observedReturn : null,
    lastSyncAt,
    couponOrders: finalOrders
      .filter((order) => usesCoupon(order, input.couponId))
      .sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime()),
  };
}
