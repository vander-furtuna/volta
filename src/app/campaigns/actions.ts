"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_CRITERIA } from "@/demo/wizard-fixture";
import { buildAudience } from "@/domain/audience/audience";
import { canProceedToReview, normalizeCouponCode, type Offer } from "@/domain/offer/offer";
import {
  advanceCoupon,
  confirmInactiveCoupon,
  CouponConfirmationError,
} from "@/server/campaigns/campaign-coupons";
import { readEnv } from "@/server/config/env";
import {
  offerSchema,
  saveCampaignAudience,
  saveCampaignOffer,
  type CampaignAudienceEntry,
} from "@/server/database/campaign-repository";
import {
  readStoreCustomerSummaries,
  readStoreOfferContext,
} from "@/server/database/customer-repository";
import { getStoreSession } from "@/server/security/store-session";

const commandSchema = z.discriminatedUnion("operation", [
  z.object({
    campaignId: z.uuid(),
    operation: z.literal("create"),
    frozenAt: z.iso.datetime({ offset: true }),
  }),
  z.object({ campaignId: z.uuid(), operation: z.enum(["activate", "mark_invitations_sent"]) }),
]);

export async function submitCampaignCoupon(_previousMessage: string | null, formData: FormData) {
  const parsed = commandSchema.safeParse({
    campaignId: formData.get("campaignId"),
    operation: formData.get("operation"),
    frozenAt: formData.get("frozenAt"),
  });
  if (!parsed.success || readEnv().DEMO_MODE) return "Esta ação não está disponível.";
  const session = await getStoreSession();
  if (session.status !== "authenticated") return "Abra o Volta pela Cardápio Web para continuar.";

  const { campaignId, operation } = parsed.data;
  try {
    if (operation === "create") {
      const outcome = await confirmInactiveCoupon(session, campaignId, parsed.data.frozenAt);
      if (outcome === "invalid") return "Revise o público e a oferta antes de criar o cupom.";
      if (outcome === "conflict") return "Esse código já está em uso na Cardápio Web.";
      if (outcome === "pending") {
        return "A criação ainda não foi confirmada. Confira o código na Cardápio Web.";
      }
    } else if (!(await advanceCoupon(session, campaignId, { type: operation }))) {
      return "A campanha mudou de estado. Atualize a página para continuar.";
    }
  } catch (error) {
    if (error instanceof CouponConfirmationError) {
      return error.inactiveConfirmed
        ? "A Cardápio Web devolveu condições diferentes da oferta revisada. O cupom está desativado."
        : "A Cardápio Web devolveu uma resposta diferente da esperada. Confira se o cupom está desativado na Cardápio Web.";
    }
    return operation === "create"
      ? "Não foi possível confirmar a criação. O rascunho está salvo."
      : "Não foi possível confirmar a atualização. Tente novamente.";
  }

  redirect(`/campaigns/${campaignId}`);
}

const audienceCommandSchema = z.object({
  campaignId: z.uuid().optional(),
  name: z.string().trim().min(1).max(120),
  intent: z.enum(["save_draft", "freeze_audience"]),
  customerIds: z.array(z.coerce.number().int().positive()),
});

export async function submitCampaignAudience(_previousMessage: string | null, formData: FormData) {
  if (readEnv().DEMO_MODE) return "Esta ação não está disponível.";
  const session = await getStoreSession();
  if (session.status !== "authenticated") return "Abra o Volta pela Cardápio Web para continuar.";

  const rawCampaignId = formData.get("campaignId");
  const parsed = audienceCommandSchema.safeParse({
    campaignId:
      typeof rawCampaignId === "string" && rawCampaignId !== "" ? rawCampaignId : undefined,
    name: formData.get("name"),
    intent: formData.get("intent"),
    customerIds: formData.getAll("customerIds"),
  });
  if (!parsed.success) return "Confira o nome da campanha e os clientes selecionados.";

  const { campaignId, name, intent, customerIds } = parsed.data;
  const selectedIds = new Set(customerIds);
  const summaries = await readStoreCustomerSummaries(session.storeId);
  const breakdown = buildAudience(summaries, DEFAULT_CRITERIA);

  const entries: CampaignAudienceEntry[] = [
    ...breakdown.included.map((customer) => ({
      customerExternalId: customer.id,
      included: selectedIds.has(customer.id),
      exclusionReason: null,
    })),
    ...breakdown.excluded.map(({ customer, reason }) => ({
      customerExternalId: customer.id,
      included: false,
      exclusionReason: reason,
    })),
  ];

  const freeze = intent === "freeze_audience";
  if (freeze && !entries.some((entry) => entry.included)) {
    return "Selecione ao menos um cliente para congelar o público.";
  }

  const saved = await saveCampaignAudience({
    storeId: session.storeId,
    userId: session.userId,
    campaignId,
    name,
    criteria: DEFAULT_CRITERIA,
    audience: entries,
    freeze,
  });
  if (!saved) return "Não foi possível salvar o público desta campanha.";

  if (freeze) {
    redirect(`/campaigns/new/offer?campaign=${saved.campaignId}`);
  }
  redirect(`/campaigns/new/audience?campaign=${saved.campaignId}`);
}

const offerCommandSchema = z.object({
  campaignId: z.uuid(),
  intent: z.enum(["save_draft", "proceed_to_review"]),
  benefit: z.enum(["fixed_amount", "percentage", "free_shipping"]),
  amount: z.number().nonnegative().nullable(),
  minimumOrderValue: z.number().nonnegative().nullable(),
  usageLimit: z.coerce.number().int().positive(),
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

function parseOptionalNumber(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : Number.NaN;
}

export async function submitCampaignOffer(_previousMessage: string | null, formData: FormData) {
  if (readEnv().DEMO_MODE) return "Esta ação não está disponível.";
  const session = await getStoreSession();
  if (session.status !== "authenticated") return "Abra o Volta pela Cardápio Web para continuar.";

  const benefit = formData.get("benefit");
  const rawCode = formData.get("couponCode");
  const parsed = offerCommandSchema.safeParse({
    campaignId: formData.get("campaignId"),
    intent: formData.get("intent"),
    benefit,
    amount: benefit === "free_shipping" ? null : parseOptionalNumber(formData.get("amount")),
    minimumOrderValue: parseOptionalNumber(formData.get("minimumOrderValue")),
    usageLimit: formData.get("usageLimit"),
    oncePerCustomer: formData.get("oncePerCustomer") === "true",
    newCustomersOnly: formData.get("newCustomersOnly") === "true",
    couponCode: typeof rawCode === "string" ? normalizeCouponCode(rawCode) : null,
    channels: formData.getAll("channels"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
  });
  if (!parsed.success) return "Revise os campos da oferta antes de continuar.";

  const { campaignId, intent, ...offerFields } = parsed.data;
  const offer: Offer = offerSchema.parse(offerFields);

  if (intent === "proceed_to_review") {
    const context = await readStoreOfferContext(session.storeId, campaignId);
    if (!canProceedToReview(offer, context)) {
      return "Resolva os avisos bloqueantes da oferta antes de revisar.";
    }
  }

  const saved = await saveCampaignOffer({
    storeId: session.storeId,
    userId: session.userId,
    campaignId,
    offer,
  });
  if (!saved) return "Não foi possível salvar a oferta. Confira o estado da campanha.";

  if (intent === "proceed_to_review") {
    redirect(`/campaigns/new/review?campaign=${campaignId}`);
  }
  redirect(`/campaigns/new/offer?campaign=${campaignId}`);
}
