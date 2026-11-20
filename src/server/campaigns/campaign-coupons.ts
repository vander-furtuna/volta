import "server-only";
import { createCampaignCoupon } from "@/application/campaigns/create-campaign-coupon";
import { refreshStoreToken } from "@/application/credentials/refresh-store-token";
import { transition, type CampaignEvent } from "@/domain/campaign/campaign-status";
import { validateOffer } from "@/domain/offer/offer";
import {
  activateCoupon,
  createCoupon,
  cwCouponInputSchema,
  findCouponByCode,
  matchesInactiveCoupon,
  type CwCouponInput,
} from "@/integrations/cardapio-web/coupons";
import { toCwCouponInput } from "@/integrations/cardapio-web/coupon-mapper";
import { createCwTokenRefresher } from "@/integrations/cardapio-web/installation";
import { CwApiError, createCwClient } from "@/integrations/cardapio-web/http-client";
import { readEnv, requireEnv } from "@/server/config/env";
import {
  countFrozenAudience,
  findStoreCampaign,
  type StoredCampaign,
} from "@/server/database/campaign-repository";
import { supabaseStoreCredentialsRepository as credentials } from "@/server/database/store-repositories";
import { getServiceClient } from "@/server/database/supabase";

type Actor = { storeId: string; userId: string };
const TOKEN_MARGIN_MS = 5 * 60_000;
const DEFINITE_REJECTIONS = [400, 401, 403, 422, 429];
const CW_TIMEOUT_MS = 30_000;

async function storeCwClient(storeId: string) {
  const now = new Date();
  let current = await credentials.load(storeId);
  if (!current) throw new Error("Store credentials unavailable");
  if (current.accessTokenExpiresAt.getTime() - now.getTime() < TOKEN_MARGIN_MS) {
    const env = readEnv();
    const refreshed = await refreshStoreToken(
      { storeId, now },
      {
        credentials,
        refresher: createCwTokenRefresher({
          clientId: requireEnv("CW_CLIENT_ID", env),
          redirectUri: env.CW_REDIRECT_URI,
          fetchImpl: (input, init) =>
            fetch(input, { ...init, signal: AbortSignal.timeout(CW_TIMEOUT_MS) }),
        }),
      },
    );
    if (refreshed.status !== "refreshed") throw new Error("Store credentials unavailable");
    current = await credentials.load(storeId);
    if (!current) throw new Error("Store credentials unavailable");
  }

  const signal = AbortSignal.timeout(CW_TIMEOUT_MS);
  return createCwClient({
    accessToken: current.accessToken,
    environment: current.environment,
    fetchImpl: (input, init) => fetch(input, { ...init, signal }),
  });
}

async function recordTransition(
  actor: Actor,
  campaign: StoredCampaign,
  event: CampaignEvent,
  releaseCreation = false,
) {
  const status = transition(campaign.status, event);
  const { data, error } = await getServiceClient().rpc("record_campaign_coupon", {
    p_store_id: actor.storeId,
    p_user_id: actor.userId,
    p_campaign_id: campaign.id,
    p_from: campaign.status,
    p_to: status,
    p_event: event.type,
    p_coupon_id: event.type === "coupon_created" ? event.couponId : null,
    p_release_creation: releaseCreation,
  });
  if (error) throw error;
  if (data !== true) throw new Error("Campaign status changed");
  return { ...campaign, status };
}

async function reserveCreation(
  actor: Actor,
  campaign: StoredCampaign,
  input: CwCouponInput,
  frozenAt: string,
) {
  const { data, error } = await getServiceClient()
    .from("campaigns")
    .update({ coupon_input: input, coupon_code: input.code, updated_at: new Date().toISOString() })
    .eq("id", campaign.id)
    .eq("store_id", actor.storeId)
    .eq("status", "audience_frozen")
    .eq("audience_frozen_at", frozenAt)
    .is("coupon_input", null)
    .select("id")
    .maybeSingle();
  if (error?.code === "23505") return false;
  if (error) throw error;
  return !!data;
}

export async function confirmInactiveCoupon(actor: Actor, campaignId: string, frozenAt: string) {
  let campaign = await findStoreCampaign(actor.storeId, campaignId);
  if (!campaign) return "invalid";
  if (campaign.coupon_external_id !== null) return "created";
  if (
    !campaign.offer ||
    campaign.audience_frozen_at !== frozenAt ||
    (campaign.status !== "audience_frozen" && campaign.status !== "creation_failed") ||
    validateOffer(campaign.offer, { audienceAverageOrderValue: 0, averageDeliveryFee: 0 }).some(
      ({ severity }) => severity === "blocking",
    ) ||
    (await countFrozenAudience(actor.storeId, campaign.id)) === 0
  )
    return "invalid";

  const input = cwCouponInputSchema.safeParse(
    campaign.coupon_input ?? toCwCouponInput(campaign.offer, campaign.name),
  );
  if (!input.success) return "invalid";
  if (campaign.status === "creation_failed") {
    campaign = await recordTransition(actor, campaign, { type: "retry_creation" });
  }
  const draft = campaign;
  const client = await storeCwClient(actor.storeId);
  return createCampaignCoupon(draft.coupon_input !== null, {
    async findByCode() {
      const existing = await findCouponByCode(client, input.data.code);
      return existing && { id: existing.id, matches: matchesInactiveCoupon(existing, input.data) };
    },
    reserveCreation: () => reserveCreation(actor, draft, input.data, frozenAt),
    async create() {
      try {
        const coupon = await createCoupon(client, input.data);
        if (coupon.active || coupon.code?.toUpperCase() !== input.data.code) {
          throw new Error("CW did not confirm an inactive coupon with the reviewed code");
        }
        return coupon.id;
      } catch (error) {
        if (error instanceof CwApiError && DEFINITE_REJECTIONS.includes(error.status)) {
          await recordTransition(
            actor,
            draft,
            { type: "coupon_creation_failed", reason: "cw_rejected" },
            true,
          );
        }
        throw error;
      }
    },
    async confirm(couponId) {
      await recordTransition(actor, draft, { type: "coupon_created", couponId });
    },
  });
}

export async function advanceCoupon(
  actor: Actor,
  campaignId: string,
  event: { type: "activate" | "mark_invitations_sent" },
) {
  const campaign = await findStoreCampaign(actor.storeId, campaignId);
  if (!campaign || campaign.coupon_external_id === null) return false;
  if (event.type === "activate") {
    if (campaign.status !== "coupon_created") return false;
    const input = cwCouponInputSchema.parse(campaign.coupon_input);
    const client = await storeCwClient(actor.storeId);
    const updated = await activateCoupon(client, campaign.coupon_external_id, input);
    if (!updated.active || updated.id !== campaign.coupon_external_id) return false;
  } else if (campaign.status !== "active") {
    return false;
  }
  await recordTransition(actor, campaign, event);
  return true;
}
