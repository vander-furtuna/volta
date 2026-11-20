import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader, MobileTabBar } from "@/components/app/app-chrome";
import { ResultsView } from "@/components/campaign/results-view";
import { DEMO_CLOSED_CAMPAIGN } from "@/demo/campaign-fixture";

export const metadata: Metadata = { title: "Volta: resultado da campanha" };

// Demo: prerender the known campaign so `params` is resolved at build time (Cache Components).
export function generateStaticParams() {
  return [{ id: DEMO_CLOSED_CAMPAIGN.id }];
}

export default async function CampaignResultsPage({
  params,
}: PageProps<"/campaigns/[id]/results">) {
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
