import type { Metadata } from "next";
import { AppHeader, MobileBackHeader, MobileWizardProgress } from "@/components/app/app-chrome";
import { AudienceBuilder } from "@/components/wizard/audience-builder";
import { WizardHeading } from "@/components/wizard/wizard-heading";
import { DEMO_CAMPAIGN } from "@/demo/wizard-fixture";

export const metadata: Metadata = { title: "Público · Volta" };

/** Step 1, "Público". Reference: design/templates/source/audience.dc.html and mobile-audience. */
export default function AudiencePage() {
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
