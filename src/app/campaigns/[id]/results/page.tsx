import { Suspense } from "react";
import type { Metadata } from "next";
import { z } from "zod";
import { notFound } from "next/navigation";
import { AppHeader, MobileTabBar } from "@/components/app/app-chrome";
import { StoreCampaignResults } from "@/components/campaign/store-campaign-results";
import { StoreAccessState } from "@/components/states/store-access-state";
import { ResultsView } from "@/components/campaign/results-view";
import { DEMO_CLOSED_CAMPAIGN } from "@/demo/campaign-fixture";
import { readEnv } from "@/server/config/env";
import { findStoreCampaign } from "@/server/database/campaign-repository";
import { readStoreCampaignResults } from "@/server/database/campaign-results-repository";
import { getStoreSession } from "@/server/security/store-session";

export const metadata: Metadata = { title: "Volta: resultado da campanha" };

// Demo: prerender the known campaign so `params` is resolved at build time (Cache Components).
export function generateStaticParams() {
  return [{ id: DEMO_CLOSED_CAMPAIGN.id }];
}

export default function CampaignResultsPage({ params }: PageProps<"/campaigns/[id]/results">) {
  if (readEnv().DEMO_MODE) return <DemoResults params={params} />;
  return (
    <Suspense>
      <StoreResults params={params} />
    </Suspense>
  );
}

async function StoreResults({ params }: Pick<PageProps<"/campaigns/[id]/results">, "params">) {
  const session = await getStoreSession();
  if (session.status !== "authenticated") {
    return <StoreAccessState blocked={session.status === "blocked"} />;
  }
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const campaign = await findStoreCampaign(session.storeId, id.data);
  if (!campaign || campaign.coupon_external_id === null) notFound();
  const results = await readStoreCampaignResults(session.storeId, campaign);
  return (
    <StoreCampaignResults campaign={campaign} storeName={session.storeName} results={results} />
  );
}

async function DemoResults({ params }: Pick<PageProps<"/campaigns/[id]/results">, "params">) {
  const { id } = await params;
  // Demo: only the closed October campaign has results to read.
  if (id !== DEMO_CLOSED_CAMPAIGN.id) notFound();

  return (
    <div className="bg-paper min-h-screen">
      <AppHeader current="results" />
      <ResultsView />
      <MobileTabBar current="results" />
    </div>
  );
}
