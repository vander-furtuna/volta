import type { Metadata } from "next";
import { AppHeader, MobileBackHeader, MobileWizardProgress } from "@/components/app/app-chrome";
import { ReviewSummary } from "@/components/wizard/review-summary";
import { WizardHeading } from "@/components/wizard/wizard-heading";
import { DEMO_STORE } from "@/demo/home-fixture";
import { DEMO_CAMPAIGN } from "@/demo/wizard-fixture";

export const metadata: Metadata = { title: "Revisão · Volta" };

/**
 * Step 3, "Revisão". The summary reads the campaign draft, so it shows exactly what was chosen.
 * Reference: design/templates/source/review.dc.html and mobile-review.dc.html.
 */
export default function ReviewPage() {
  return (
    <div className="bg-paper flex min-h-screen flex-col">
      <AppHeader current="new" mobile={false} />
      <MobileBackHeader
        title={DEMO_CAMPAIGN.name}
        subtitle={`Rascunho, salvo às ${DEMO_CAMPAIGN.reviewSavedAt}`}
        backLabel="Sair para o início"
      >
        <MobileWizardProgress step={3} />
      </MobileBackHeader>

      <main className="max-w-content mx-auto flex w-full flex-1 flex-col gap-5 px-4 pt-5 md:gap-7 md:px-8 md:pt-7 md:pb-24">
        <WizardHeading step={3} savedAt={DEMO_CAMPAIGN.reviewSavedAt} />

        {/* Store confirmation */}
        <div className="bg-mint text-mint-ink flex flex-col gap-1.5 rounded-2xl px-4 py-3.5 md:flex-row md:flex-wrap md:items-center md:gap-3.5 md:px-5 md:py-4">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-status-active-ink hidden size-[22px] md:block"
          >
            <path d="M3 9l1.5-5h15L21 9" />
            <path d="M4 9v11h16V9" />
            <path d="M9 20v-6h6v6" />
          </svg>
          <p className="text-sm leading-normal md:flex-[1_1_320px] md:text-[15px]">
            <span className="hidden md:inline">
              <b>
                O cupom será criado na {DEMO_STORE.name}, unidade {DEMO_STORE.unit}.
              </b>{" "}
              Cada instalação do Volta vale para uma única unidade.
            </span>
            <span className="md:hidden">
              <b>Será criado na Dois Irmãos, unidade {DEMO_STORE.unit}.</b> Cada instalação vale
              para uma única unidade.
            </span>
          </p>
          <button
            type="button"
            className="text-mint-ink flex min-h-8 items-center self-start text-sm font-semibold underline md:self-auto"
          >
            Não é esta loja?
          </button>
        </div>

        <ReviewSummary />
      </main>
    </div>
  );
}
