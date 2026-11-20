import "server-only";
import { z } from "zod";
import type { AudienceCriteria, ExclusionReason } from "@/domain/audience/audience";
import { transition, type CampaignStatus } from "@/domain/campaign/campaign-status";
import { normalizeCouponCode, type Offer } from "@/domain/offer/offer";
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

export const audienceCriteriaSchema = z.object({
  minCompletedOrders: z.number().int().positive(),
  minDaysSinceLastOrder: z.number().int().nonnegative(),
  minDaysBetweenInvitations: z.number().int().nonnegative(),
});

const exclusionReasonSchema = z.enum(["whatsapp_not_allowed", "missing_phone", "recently_invited"]);

const audienceEntryRowSchema = z.object({
  customer_external_id: z.number().int().positive(),
  included: z.boolean(),
  exclusion_reason: exclusionReasonSchema.nullable(),
});

export interface CampaignAudienceEntry {
  customerExternalId: number;
  included: boolean;
  exclusionReason: ExclusionReason | null;
}

export async function readCampaignAudienceSelection(
  storeId: string,
  campaignId: string,
): Promise<CampaignAudienceEntry[]> {
  const { data, error } = await getServiceClient()
    .from("campaign_audience")
    .select("customer_external_id, included, exclusion_reason, campaigns!inner(store_id)")
    .eq("campaigns.store_id", storeId)
    .eq("campaign_id", campaignId)
    .order("customer_external_id", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return z
    .array(audienceEntryRowSchema)
    .parse(data ?? [])
    .map((row) => ({
      customerExternalId: row.customer_external_id,
      included: row.included,
      exclusionReason: row.exclusion_reason,
    }));
}

export function resolveAudienceSaveStatus(
  currentStatus: CampaignStatus | null,
  freeze: boolean,
): CampaignStatus | null {
  if (currentStatus === null) {
    return freeze ? transition("draft", { type: "freeze_audience" }) : "draft";
  }
  if (freeze) {
    if (currentStatus === "draft") return transition("draft", { type: "freeze_audience" });
    if (currentStatus === "audience_frozen") return "audience_frozen";
    if (currentStatus === "creation_failed") {
      return transition("creation_failed", { type: "retry_creation" });
    }
    return null;
  }
  if (currentStatus === "audience_frozen") {
    return transition("audience_frozen", { type: "unfreeze_audience" });
  }
  if (currentStatus === "draft") return "draft";
  return null;
}

export async function saveCampaignAudience(input: {
  storeId: string;
  userId: string;
  campaignId?: string;
  name: string;
  criteria: AudienceCriteria;
  audience: readonly CampaignAudienceEntry[];
  freeze: boolean;
  now?: Date;
}): Promise<{ campaignId: string; status: CampaignStatus } | null> {
  const trimmedName = input.name.trim();
  if (!trimmedName) return null;
  const criteria = audienceCriteriaSchema.parse(input.criteria);
  const includedCount = input.audience.filter((entry) => entry.included).length;
  if (input.freeze && includedCount === 0) return null;

  const nowIso = (input.now ?? new Date()).toISOString();
  const client = getServiceClient();

  let campaignId = input.campaignId;
  let fromStatus: CampaignStatus | null = null;

  if (campaignId) {
    const existing = await findStoreCampaign(input.storeId, campaignId);
    if (!existing || existing.coupon_external_id !== null || existing.coupon_input !== null) {
      return null;
    }
    fromStatus = existing.status;
  }

  const nextStatus = resolveAudienceSaveStatus(fromStatus, input.freeze);
  if (!nextStatus) return null;

  if (campaignId) {
    const { data, error } = await client
      .from("campaigns")
      .update({
        name: trimmedName,
        status: nextStatus,
        audience_criteria: criteria,
        audience_frozen_at: input.freeze ? nowIso : null,
        updated_at: nowIso,
      })
      .eq("id", campaignId)
      .eq("store_id", input.storeId)
      .is("coupon_external_id", null)
      .is("coupon_input", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
  } else {
    const { data, error } = await client
      .from("campaigns")
      .insert({
        store_id: input.storeId,
        name: trimmedName,
        status: nextStatus,
        audience_criteria: criteria,
        audience_frozen_at: input.freeze ? nowIso : null,
        created_by: input.userId,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id")
      .single();
    if (error) throw error;
    campaignId = z.object({ id: z.uuid() }).parse(data).id;
  }

  const { error: deleteError } = await client
    .from("campaign_audience")
    .delete()
    .eq("campaign_id", campaignId);
  if (deleteError) throw deleteError;

  if (input.audience.length > 0) {
    const rows = input.audience.map((entry) => ({
      campaign_id: campaignId,
      customer_external_id: entry.customerExternalId,
      included: entry.included,
      exclusion_reason: entry.included ? null : entry.exclusionReason,
    }));
    const { error: insertError } = await client.from("campaign_audience").insert(rows);
    if (insertError) throw insertError;
  }

  const { error: eventError } = await client.from("campaign_events").insert({
    campaign_id: campaignId,
    event_type: input.freeze ? "freeze_audience" : "save_audience_draft",
    from_status: fromStatus,
    to_status: nextStatus,
    actor_user_id: input.userId,
    details: { includedCount },
  });
  if (eventError) throw eventError;

  return { campaignId, status: nextStatus };
}

export async function saveCampaignOffer(input: {
  storeId: string;
  userId: string;
  campaignId: string;
  offer: Offer;
  now?: Date;
}): Promise<boolean> {
  const parsedOffer = offerSchema.safeParse({
    ...input.offer,
    couponCode: normalizeCouponCode(input.offer.couponCode),
  });
  if (!parsedOffer.success) return false;

  const existing = await findStoreCampaign(input.storeId, input.campaignId);
  if (
    !existing ||
    existing.coupon_external_id !== null ||
    existing.coupon_input !== null ||
    (existing.status !== "draft" &&
      existing.status !== "audience_frozen" &&
      existing.status !== "creation_failed")
  ) {
    return false;
  }

  const nowIso = (input.now ?? new Date()).toISOString();
  const client = getServiceClient();

  const { data, error } = await client
    .from("campaigns")
    .update({
      offer: parsedOffer.data,
      coupon_code: parsedOffer.data.couponCode,
      updated_at: nowIso,
    })
    .eq("id", input.campaignId)
    .eq("store_id", input.storeId)
    .is("coupon_external_id", null)
    .is("coupon_input", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;

  const { error: eventError } = await client.from("campaign_events").insert({
    campaign_id: input.campaignId,
    event_type: "save_offer",
    from_status: existing.status,
    to_status: existing.status,
    actor_user_id: input.userId,
  });
  if (eventError) throw eventError;

  return true;
}
