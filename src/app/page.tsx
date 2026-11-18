import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CampaignStatusChip, StatusChip } from "@/components/ui/status-chip";
import { DEMO_CAMPAIGNS, DEMO_OPPORTUNITY } from "@/demo/home-fixture";

/**
 * Home screen. Reference: design/templates/html/home.html (desktop) and mobile-home.html.
 * Starting point only: the header, the dot chart and the data-coverage card are still to build.
 */
export default function HomePage() {
  const opportunity = DEMO_OPPORTUNITY;
  const identifiedPercent = Math.round(opportunity.identifiedOrderShare * 100);

  return (
    <main className="max-w-content mx-auto flex w-full flex-col gap-10 px-4 pt-4 pb-24 md:px-8 md:pt-8">
      <StatusChip tone="paused" label="Dados de demonstração" className="self-start" />

      <section
        aria-labelledby="opportunity-title"
        className="bg-forest md:rounded-panel flex flex-col gap-5 rounded-3xl p-6 text-white md:p-12"
      >
        <p className="text-sprout text-sm">
          Atualizado hoje às {opportunity.updatedAtLabel} com o histórico desde{" "}
          {opportunity.historyStartLabel}
        </p>
        <h1
          id="opportunity-title"
          className="font-heading max-w-[17ch] text-[30px] leading-[1.06] font-semibold text-balance md:text-5xl"
        >
          {opportunity.frequentCustomersWithoutOrder} clientes frequentes sem pedido identificado há
          mais de {opportunity.minDaysSinceLastOrder} dias
        </h1>
        <p className="max-w-[52ch] text-[15px] leading-relaxed text-white/80 md:text-[17px]">
          Frequente, aqui, é quem fez {opportunity.minCompletedOrders} ou mais pedidos concluídos no
          período. Como {identifiedPercent}% dos pedidos têm cliente identificado, parte deles pode
          ter comprado sem se identificar.
        </p>
        <div className="flex flex-col gap-3 pt-1 sm:flex-row">
          <Button asChild>
            <Link href="/campaigns/new/audience">Revisar público</Link>
          </Button>
          <Button asChild variant="onDark">
            <Link href="/campaigns/new/audience">Mudar critério</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="campaigns-title" className="flex flex-col gap-5">
        <h2 id="campaigns-title" className="font-heading text-[22px] font-semibold md:text-[28px]">
          Suas campanhas
        </h2>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-5">
          {DEMO_CAMPAIGNS.map((campaign) => (
            <li
              key={campaign.id}
              className="rounded-card border-border bg-surface flex flex-col gap-2.5 border p-5"
            >
              <CampaignStatusChip status={campaign.status} className="self-start" />
              <h3 className="text-[17px] font-semibold">{campaign.name}</h3>
              <p className="text-graphite text-sm">{campaign.summary}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
