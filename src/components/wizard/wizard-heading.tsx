import Link from "next/link";
import type { WizardStep } from "@/components/app/app-chrome";
import { StatusChip } from "@/components/ui/status-chip";
import { DEMO_CAMPAIGN } from "@/demo/wizard-fixture";
import { WizardStepsLive } from "./wizard-steps-live";

/**
 * Desktop wizard heading: back link, campaign name with status and save time, step nav.
 * Reference: the first block of <main> in audience/offer/review.dc.html. Hidden on mobile,
 * which uses MobileBackHeader + MobileWizardProgress instead.
 */
export function WizardHeading({ step, savedAt }: { step: WizardStep; savedAt: string }) {
  return (
    <div className="hidden flex-col gap-[18px] md:flex">
      <Link
        href="/"
        className="text-forest hover:text-forest-deep inline-flex min-h-8 items-center gap-1.5 self-start text-sm font-semibold no-underline"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="size-4"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Início
      </Link>
      <div className="flex flex-wrap items-center gap-3.5">
        <h1 className="font-heading text-[38px] font-semibold">{DEMO_CAMPAIGN.name}</h1>
        <StatusChip tone="draft" label="Rascunho" />
        <span className="text-graphite text-sm">Salvo às {savedAt}</span>
      </div>
      <WizardStepsLive step={step} />
    </div>
  );
}
