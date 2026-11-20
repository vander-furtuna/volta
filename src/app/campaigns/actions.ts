"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  advanceCoupon,
  confirmInactiveCoupon,
  CouponConfirmationError,
} from "@/server/campaigns/campaign-coupons";
import { readEnv } from "@/server/config/env";
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
