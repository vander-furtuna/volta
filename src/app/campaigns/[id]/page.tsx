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

export default async function CouponCreatedPage({ params }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  if (id !== DEMO_NEW_CAMPAIGN_ID) notFound();

  return (
    <div className="bg-paper min-h-screen">
      <AppHeader current="new" mobile={false} />
      <CouponCreatedView name={DEMO_CAMPAIGN.name} />
    </div>
  );
}
