import type { Metadata } from "next";
import { AppHeader, MobileBackHeader, MobileWizardProgress } from "@/components/app/app-chrome";
import { OfferEditor } from "@/components/wizard/offer-editor";
import { WizardHeading } from "@/components/wizard/wizard-heading";
import { DEMO_CAMPAIGN } from "@/demo/wizard-fixture";

export const metadata: Metadata = { title: "Oferta e limites · Volta" };

/** Step 2, "Oferta e limites". Reference: design/templates/source/offer.dc.html and mobile-offer. */
export default function OfferPage() {
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
