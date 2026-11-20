import "server-only";
import { z } from "zod";
import {
  campaignResultWindow,
  summarizeStoredCampaign,
  type SyncedOrder,
} from "@/domain/metrics/stored-campaign-results";
import type { StoredCampaign } from "./campaign-repository";
import { getServiceClient } from "./supabase";

const PAGE_SIZE = 500;
const idSchema = z.number().int().positive();
const audiencePageSchema = z.array(z.object({ customer_external_id: idSchema }));
const orderPageSchema = z.array(
  z.object({
    id: z.uuid(),
    external_id: idSchema,
    customer_external_id: idSchema.nullable(),
    outcome: z.enum(["completed", "canceled", "open"]),
    total: z.number(),
    sales_channel: z.string(),
    placed_at: z.iso.datetime({ offset: true }),
    synced_at: z.iso.datetime({ offset: true }),
    order_discounts: z.array(
      z.object({
        category: z.enum(["coupon", "loyalty", "other"]),
        coupon_external_id: idSchema.nullable(),
        amount: z.number(),
        sponsor: z.enum(["merchant", "ifood"]),
      }),
    ),
  }),
);

async function readFrozenAudience(storeId: string, campaignId: string) {
  const included = new Set<number>();
  let after = 0;
  while (true) {
    const { data, error } = await getServiceClient()
      .from("campaign_audience")
      .select("customer_external_id, campaigns!inner(store_id)")
      .eq("campaign_id", campaignId)
      .eq("campaigns.store_id", storeId)
      .eq("included", true)
      .gt("customer_external_id", after)
      .order("customer_external_id")
      .limit(PAGE_SIZE);
    if (error) throw error;
    const page = audiencePageSchema.parse(data);
    for (const { customer_external_id } of page) {
      included.add(customer_external_id);
      after = customer_external_id;
    }
    if (page.length < PAGE_SIZE) return included;
  }
}

async function readOrders(storeId: string, startsAt: Date, endsAt: Date) {
  const orders: SyncedOrder[] = [];
  let after: string | undefined;
  while (true) {
    let query = getServiceClient()
      .from("orders")
      .select(
        "id, external_id, customer_external_id, outcome, total, sales_channel, placed_at, synced_at, order_discounts(category, coupon_external_id, amount, sponsor)",
      )
      .eq("store_id", storeId)
      .gte("placed_at", startsAt.toISOString())
      .lte("placed_at", endsAt.toISOString())
      .order("id")
      .limit(PAGE_SIZE);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw error;
    const page = orderPageSchema.parse(data);
    for (const order of page) {
      orders.push({
        id: order.external_id,
        customerId: order.customer_external_id,
        outcome: order.outcome,
        total: order.total,
        channel: order.sales_channel,
        placedAt: new Date(order.placed_at),
        syncedAt: new Date(order.synced_at),
        discounts: order.order_discounts.map((discount) => ({
          category: discount.category,
          couponId: discount.coupon_external_id,
          amount: discount.amount,
          sponsor: discount.sponsor,
        })),
      });
      after = order.id;
    }
    if (page.length < PAGE_SIZE) return orders;
  }
}

export async function readStoreCampaignResults(storeId: string, campaign: StoredCampaign) {
  const { offer, coupon_external_id: couponId, follow_up_ends_at: deadline } = campaign;
  if (!offer || couponId === null) return null;
  const window = campaignResultWindow(
    offer.startsOn,
    offer.endsOn,
    deadline ? new Date(deadline) : null,
  );
  if (!window) return null;
  const [orders, invitedCustomerIds] = await Promise.all([
    readOrders(storeId, window.startsAt, window.followUpEndsAt),
    readFrozenAudience(storeId, campaign.id),
  ]);
  return {
    ...window,
    ...summarizeStoredCampaign(
      { ...window, couponId, orders, invitedCustomerIds },
      campaign.invitations_marked_at !== null,
    ),
  };
}
