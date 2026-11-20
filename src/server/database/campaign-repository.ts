import "server-only";
import { z } from "zod";
import { getServiceClient } from "./supabase";

const campaignStatusSchema = z.enum([
  "draft",
  "audience_frozen",
  "creation_failed",
  "coupon_created",
  "active",
  "invitations_sent",
  "paused",
  "closed",
]);

const campaignListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: campaignStatusSchema,
  coupon_external_id: z.number().int().positive().nullable(),
});

export const offerSchema = z.object({
  benefit: z.enum(["fixed_amount", "percentage", "free_shipping"]),
  amount: z.number().nonnegative().nullable(),
  minimumOrderValue: z.number().nonnegative().nullable(),
  usageLimit: z.number().int().positive(),
  oncePerCustomer: z.boolean(),
  newCustomersOnly: z.boolean(),
  couponCode: z.string().trim().max(100).nullable(),
  channels: z
    .array(z.enum(["delivery", "takeout", "dine_in"]))
    .min(1)
    .max(3),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
});

const campaignSchema = campaignListItemSchema.extend({
  offer: offerSchema.nullable(),
  coupon_code: z.string().nullable(),
  coupon_input: z.unknown(),
  audience_frozen_at: z.iso.datetime({ offset: true }).nullable(),
  follow_up_ends_at: z.iso.datetime({ offset: true }).nullable(),
  invitations_marked_at: z.iso.datetime({ offset: true }).nullable(),
});

export type StoredCampaign = z.infer<typeof campaignSchema>;

export async function listStoreCampaigns(storeId: string) {
  const { data, error } = await getServiceClient()
    .from("campaigns")
    .select("id, name, status, coupon_external_id")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return z.array(campaignListItemSchema).parse(data);
}

export async function findStoreCampaign(storeId: string, campaignId: string) {
  const { data, error } = await getServiceClient()
    .from("campaigns")
    .select(
      "id, name, status, offer, coupon_code, coupon_input, coupon_external_id, audience_frozen_at, follow_up_ends_at, invitations_marked_at",
    )
    .eq("store_id", storeId)
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw error;
  return data && campaignSchema.parse(data);
}

export async function countFrozenAudience(storeId: string, campaignId: string) {
  const { count, error } = await getServiceClient()
    .from("campaign_audience")
    .select("campaigns!inner(store_id)", { head: true, count: "exact" })
    .eq("campaigns.store_id", storeId)
    .eq("campaign_id", campaignId)
    .eq("included", true);
  if (error) throw error;
  return count ?? 0;
}
