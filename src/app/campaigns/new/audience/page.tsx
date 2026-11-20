import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import type { Metadata } from "next";
import { AppHeader, MobileBackHeader, MobileWizardProgress } from "@/components/app/app-chrome";
import { StoreAccessState } from "@/components/states/store-access-state";
import { AudienceBuilder } from "@/components/wizard/audience-builder";
import { StoreCampaignAudience } from "@/components/wizard/store-campaign-audience";
import { WizardHeading } from "@/components/wizard/wizard-heading";
import { DEFAULT_CRITERIA, DEMO_CAMPAIGN } from "@/demo/wizard-fixture";
import { readEnv } from "@/server/config/env";
import {
  findStoreCampaign,
  readCampaignAudienceSelection,
} from "@/server/database/campaign-repository";
import { readStoreCustomerSummaries } from "@/server/database/customer-repository";
import { getStoreSession } from "@/server/security/store-session";

export const metadata: Metadata = { title: "Público · Volta" };

/** Step 1, "Público". Reference: design/templates/source/audience.dc.html and mobile-audience. */
export default function AudiencePage({ searchParams }: PageProps<"/campaigns/new/audience">) {
  if (readEnv().DEMO_MODE) return <DemoAudiencePage />;
  return (
    <Suspense>
      <StoreAudiencePage searchParams={searchParams} />
    </Suspense>
  );
}

async function StoreAudiencePage({
  searchParams,
}: Pick<PageProps<"/campaigns/new/audience">, "searchParams">) {
  const session = await getStoreSession();
  if (session.status !== "authenticated") {
    return <StoreAccessState blocked={session.status === "blocked"} />;
  }

  const rawCampaign = (await searchParams).campaign;
  let campaignId: string | undefined;
  let initialName = "Campanha de recompra";
  let initialSelectedIds: number[] | undefined;

  if (rawCampaign !== undefined) {
    const parsedId = z.uuid().safeParse(rawCampaign);
    if (!parsedId.success) redirect("/");
    const campaign = await findStoreCampaign(session.storeId, parsedId.data);
    if (!campaign) notFound();
    if (campaign.coupon_external_id !== null) redirect(`/campaigns/${campaign.id}`);
    campaignId = campaign.id;
    initialName = campaign.name;
    const selection = await readCampaignAudienceSelection(session.storeId, campaign.id);
    if (selection.length > 0) {
      initialSelectedIds = selection
        .filter((entry) => entry.included)
        .map((entry) => entry.customerExternalId);
    }
  }

  const now = new Date();
  const customers = await readStoreCustomerSummaries(session.storeId, now);

  return (
    <StoreCampaignAudience
      storeName={session.storeName}
      campaignId={campaignId}
      initialName={initialName}
      criteria={DEFAULT_CRITERIA}
      customers={customers}
      initialSelectedIds={initialSelectedIds}
      nowIso={now.toISOString()}
    />
  );
}

function DemoAudiencePage() {
  return (
    <div className="bg-paper flex min-h-screen flex-col">
      <AppHeader current="new" mobile={false} />
      <MobileBackHeader
        title={DEMO_CAMPAIGN.name}
        titleAs="h1"
        subtitle={`Rascunho, salvo às ${DEMO_CAMPAIGN.audienceSavedAt}`}
        backLabel="Sair para o início"
      >
        <MobileWizardProgress step={1} />
      </MobileBackHeader>
      <main className="max-w-content mx-auto flex w-full flex-1 flex-col gap-5 px-4 pt-5 md:gap-7 md:px-8 md:pt-7 md:pb-24">
        <WizardHeading step={1} savedAt={DEMO_CAMPAIGN.audienceSavedAt} />
        <AudienceBuilder />
      </main>
    </div>
  );
}
