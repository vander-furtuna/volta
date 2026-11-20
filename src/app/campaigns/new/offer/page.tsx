import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import type { Metadata } from "next";
import { AppHeader, MobileBackHeader, MobileWizardProgress } from "@/components/app/app-chrome";
import { StoreAccessState } from "@/components/states/store-access-state";
import { OfferEditor } from "@/components/wizard/offer-editor";
import { StoreCampaignOffer } from "@/components/wizard/store-campaign-offer";
import { WizardHeading } from "@/components/wizard/wizard-heading";
import { DEMO_CAMPAIGN, DEMO_OFFER } from "@/demo/wizard-fixture";
import { readEnv } from "@/server/config/env";
import { countFrozenAudience, findStoreCampaign } from "@/server/database/campaign-repository";
import { readStoreOfferContext } from "@/server/database/customer-repository";
import { getStoreSession } from "@/server/security/store-session";

export const metadata: Metadata = { title: "Oferta e limites · Volta" };

/** Step 2, "Oferta e limites". Reference: design/templates/source/offer.dc.html and mobile-offer. */
export default function OfferPage({ searchParams }: PageProps<"/campaigns/new/offer">) {
  if (readEnv().DEMO_MODE) return <DemoOfferPage />;
  return (
    <Suspense>
      <StoreOfferPage searchParams={searchParams} />
    </Suspense>
  );
}

async function StoreOfferPage({
  searchParams,
}: Pick<PageProps<"/campaigns/new/offer">, "searchParams">) {
  const session = await getStoreSession();
  if (session.status !== "authenticated") {
    return <StoreAccessState blocked={session.status === "blocked"} />;
  }

  const parsedId = z.uuid().safeParse((await searchParams).campaign);
  if (!parsedId.success) redirect("/campaigns/new/audience");

  const campaign = await findStoreCampaign(session.storeId, parsedId.data);
  if (!campaign) notFound();
  if (campaign.coupon_external_id !== null) redirect(`/campaigns/${campaign.id}`);

  const [audienceCount, context] = await Promise.all([
    countFrozenAudience(session.storeId, campaign.id),
    readStoreOfferContext(session.storeId, campaign.id),
  ]);
  if (audienceCount === 0 || !campaign.audience_frozen_at) {
    redirect(`/campaigns/new/audience?campaign=${campaign.id}`);
  }

  return (
    <StoreCampaignOffer
      storeName={session.storeName}
      campaignId={campaign.id}
      campaignName={campaign.name}
      audienceCount={audienceCount}
      initialOffer={campaign.offer ?? DEMO_OFFER}
      context={context}
    />
  );
}

function DemoOfferPage() {
  return (
    <div className="bg-paper flex min-h-screen flex-col">
      <AppHeader current="new" mobile={false} />
      <MobileBackHeader
        title={DEMO_CAMPAIGN.name}
        titleAs="h1"
        subtitle={`Rascunho, salvo às ${DEMO_CAMPAIGN.offerSavedAt}`}
        backLabel="Sair para o início"
      >
        <MobileWizardProgress step={2} />
      </MobileBackHeader>
      <main className="max-w-content mx-auto flex w-full flex-1 flex-col gap-5 px-4 pt-5 md:gap-7 md:px-8 md:pt-7 md:pb-24">
        <WizardHeading step={2} savedAt={DEMO_CAMPAIGN.offerSavedAt} />
        <OfferEditor />
      </main>
    </div>
  );
}
