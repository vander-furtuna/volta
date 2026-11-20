"use client";

import { WizardSteps, type WizardStep } from "@/components/app/app-chrome";
import { useCampaignDraft, useDraftAudience } from "@/demo/campaign-draft";
import { offerStepSummary } from "./offer-text";

/** Desktop step nav with summaries of the finished steps, read from the campaign draft. */
export function WizardStepsLive({ step }: { step: WizardStep }) {
  const { offer } = useCampaignDraft();
  const { selectedCount } = useDraftAudience();
  return (
    <WizardSteps
      step={step}
      summaries={{
        1: `Público: ${selectedCount} ${selectedCount === 1 ? "cliente" : "clientes"}`,
        2: `Oferta: ${offerStepSummary(offer)}`,
      }}
    />
  );
}
