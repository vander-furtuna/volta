import { Suspense } from "react";
import Link from "next/link";
import { z } from "zod";
import { CampaignCouponForm } from "@/components/campaign/campaign-coupon-form";
import { StoreAccessState } from "@/components/states/store-access-state";
import { CampaignStatusChip } from "@/components/ui/status-chip";
import { readEnv } from "@/server/config/env";
import { findStoreCampaign } from "@/server/database/campaign-repository";
import { getStoreSession } from "@/server/security/store-session";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app/app-chrome";
import { CouponCreatedView } from "@/components/campaign/coupon-created-view";
import { DEMO_NEW_CAMPAIGN_ID } from "@/demo/campaign-fixture";
import { DEMO_CAMPAIGN } from "@/demo/wizard-fixture";

export const metadata: Metadata = { title: "Volta: cupom criado" };

// Demo: prerender the known campaign so `params` is resolved at build time (Cache Components).
export function generateStaticParams() {
  return [{ id: DEMO_NEW_CAMPAIGN_ID }];
}

export default function CouponCreatedPage({ params }: PageProps<"/campaigns/[id]">) {
  if (readEnv().DEMO_MODE) return <DemoCoupon params={params} />;
  return (
    <Suspense>
      <StoreCoupon params={params} />
    </Suspense>
  );
}

async function StoreCoupon({ params }: Pick<PageProps<"/campaigns/[id]">, "params">) {
  const session = await getStoreSession();
  if (session.status !== "authenticated") {
    return <StoreAccessState blocked={session.status === "blocked"} />;
  }
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const campaign = await findStoreCampaign(session.storeId, id.data);
  if (!campaign || campaign.coupon_external_id === null) notFound();

  return (
    <main className="max-w-content mx-auto grid w-full gap-5 px-4 py-5 md:px-8 md:py-7">
      <Link href="/" className="text-forest inline-flex min-h-11 items-center font-semibold">
        Início
      </Link>
      <p className="text-graphite text-sm">{session.storeName}</p>
      <section className="bg-surface border-border rounded-card grid gap-4 border p-5 md:p-8">
        <h1 className="font-heading text-3xl font-semibold">{campaign.name}</h1>
        <div>
          <CampaignStatusChip status={campaign.status} />
        </div>
        <p>
          Cupom <strong>{campaign.coupon_code}</strong> na Cardápio Web, nº{" "}
          {campaign.coupon_external_id}.
        </p>
        {campaign.status === "coupon_created" && (
          <CampaignCouponForm campaignId={campaign.id} operation="activate" label="Ativar cupom" />
        )}
        {campaign.status === "active" && (
          <CampaignCouponForm
            campaignId={campaign.id}
            operation="mark_invitations_sent"
            label="Marcar convites como enviados"
          />
        )}
      </section>
      <Link
        href={`/campaigns/${campaign.id}/results`}
        className="text-forest inline-flex min-h-11 w-fit items-center font-semibold"
      >
        Ver resultados
      </Link>
    </main>
  );
}

async function DemoCoupon({ params }: Pick<PageProps<"/campaigns/[id]">, "params">) {
  const { id } = await params;
  if (id !== DEMO_NEW_CAMPAIGN_ID) notFound();

  return (
    <div className="bg-paper min-h-screen">
      <AppHeader current="new" mobile={false} />
      <CouponCreatedView name={DEMO_CAMPAIGN.name} />
    </div>
  );
}
