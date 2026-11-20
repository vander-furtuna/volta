import { Suspense } from "react";
import Link from "next/link";
import { AppHeader, MobileTabBar } from "@/components/app/app-chrome";
import { CampaignList } from "@/components/home/campaign-list";
import { DotChart } from "@/components/home/dot-chart";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import {
  DEMO_CAMPAIGNS,
  DEMO_IDENTIFIED_BY_CHANNEL,
  DEMO_OPPORTUNITY,
  LOW_IDENTIFICATION_SHARE,
} from "@/demo/home-fixture";
import { DAYS_SINCE_LAST_ORDER_BUCKETS } from "@/demo/wizard-fixture";
import { cn } from "@/lib/utils";
import { StoreAccessState } from "@/components/states/store-access-state";
import { readEnv } from "@/server/config/env";
import { getStoreSession } from "@/server/security/store-session";

/** Home screen. Reference: design/templates/source/home.dc.html and mobile-home.dc.html. */

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-5"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function ChannelBars() {
  return DEMO_IDENTIFIED_BY_CHANNEL.map(({ channel, share }) => {
    const percent = `${Math.round(share * 100)}%`;
    return (
      <div key={channel} className="flex flex-col gap-1.5">
        <div className="flex justify-between text-sm">
          <span>{channel}</span>
          <span className="tabular font-semibold">{percent}</span>
        </div>
        <div className="bg-border-soft h-2 rounded-full md:h-2.5">
          <div
            className={cn(
              "h-full rounded-full",
              share < LOW_IDENTIFICATION_SHARE ? "bg-ember" : "bg-forest",
            )}
            style={{ width: percent }}
          />
        </div>
      </div>
    );
  });
}

export default function HomePage() {
  if (readEnv().DEMO_MODE) return <DemoHome />;
  return (
    <Suspense>
      <StoreHome />
    </Suspense>
  );
}

async function StoreHome() {
  const session = await getStoreSession();
  if (session.status !== "authenticated") {
    return <StoreAccessState blocked={session.status === "blocked"} />;
  }
  return (
    <main className="max-w-content mx-auto flex w-full flex-col gap-4 px-4 py-8 md:px-8">
      <p className="text-graphite text-sm">{session.storeName}</p>
      <h1 className="font-heading text-3xl font-semibold">Campanhas de recompra</h1>
    </main>
  );
}

function DemoHome() {
  const opportunity = DEMO_OPPORTUNITY;
  const identifiedPercent = Math.round(opportunity.identifiedOrderShare * 100);
  const frequentTotal = DAYS_SINCE_LAST_ORDER_BUCKETS.reduce((sum, count) => sum + count, 0);
  const headline = `${opportunity.frequentCustomersWithoutOrder} clientes frequentes sem pedido identificado há mais de ${opportunity.minDaysSinceLastOrder} dias`;

  return (
    <div className="bg-paper flex min-h-screen flex-col">
      <AppHeader current="home" />
      <p className="bg-status-paused text-status-paused-ink px-4 py-1.5 text-center text-xs font-semibold md:hidden">
        Dados de demonstração
      </p>

      <main className="max-w-content mx-auto flex w-full flex-col gap-6 px-4 pt-4 pb-28 md:gap-10 md:px-8 md:pt-8 md:pb-24">
        {/* Hero: opportunity */}
        <section
          aria-labelledby="oportunidade"
          className="bg-forest md:rounded-panel grid items-center gap-4 rounded-[24px] px-5 pt-6 pb-5 text-white md:grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] md:gap-10 md:px-12 md:pt-12 md:pb-10"
        >
          <div className="contents md:flex md:flex-col md:gap-[22px]">
            <p className="text-sprout flex items-center gap-1.5 text-[13px] md:gap-2 md:text-sm">
              <RefreshIcon className="size-3.5 md:size-4" />
              <span>
                Atualizado hoje às {opportunity.updatedAtLabel}
                <span className="hidden md:inline">
                  {" "}
                  com o histórico desde {opportunity.historyStartLabel}
                </span>
              </span>
            </p>
            <h1
              id="oportunidade"
              className="font-heading max-w-[17ch] text-[30px] leading-[1.08] font-semibold text-balance md:text-5xl md:leading-[1.04]"
            >
              {headline}
            </h1>
            <p className="hidden max-w-[52ch] text-[17px] leading-relaxed text-white/80 md:block">
              Frequente, aqui, é quem fez {opportunity.minCompletedOrders} ou mais pedidos
              concluídos no período. Como {identifiedPercent}% dos pedidos têm cliente identificado,
              parte deles pode ter comprado sem se identificar.
            </p>
            <figure className="flex flex-col gap-2 rounded-2xl bg-white/5 px-2.5 pt-3.5 pb-2.5 md:hidden">
              <DotChart
                variant="mobile"
                total={frequentTotal}
                opportunity={opportunity.frequentCustomersWithoutOrder}
              />
              <figcaption className="px-1 text-xs leading-normal text-white/70">
                Cada ponto é um cliente. Os {opportunity.frequentCustomersWithoutOrder} à direita da
                linha entram na oportunidade.
              </figcaption>
            </figure>
            <p className="text-[15px] leading-[1.55] text-white/80 md:hidden">
              Frequente é quem fez {opportunity.minCompletedOrders} ou mais pedidos concluídos.{" "}
              {identifiedPercent}% dos pedidos têm cliente identificado, então parte deles pode ter
              comprado sem se identificar.
            </p>
            <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:gap-3 md:pt-1.5">
              <Button asChild className="w-full md:w-auto">
                <Link href="/campaigns/new/audience">Revisar público</Link>
              </Button>
              <Button asChild variant="onDark" className="w-full md:w-auto">
                <Link href="/campaigns/new/audience">Mudar critério</Link>
              </Button>
            </div>
          </div>
          <figure className="hidden flex-col gap-3 rounded-[22px] bg-white/5 px-5 pt-[22px] pb-[18px] md:flex">
            <DotChart
              variant="desktop"
              total={frequentTotal}
              opportunity={opportunity.frequentCustomersWithoutOrder}
            />
            <figcaption className="text-[13px] leading-normal text-white/70">
              Cada ponto é um cliente frequente, posicionado pelos dias desde o último pedido. Os{" "}
              {opportunity.frequentCustomersWithoutOrder} à direita da linha entram na oportunidade.
            </figcaption>
          </figure>
        </section>

        {/* Shortcuts */}
        <section
          aria-label="Atalhos"
          className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] md:gap-6"
        >
          <Link
            href="/campaigns/new/offer"
            className="bg-peach text-ink flex items-center gap-3.5 rounded-[20px] p-5 no-underline md:min-h-[180px] md:flex-col md:items-stretch md:rounded-3xl md:p-8"
          >
            <span className="flex flex-auto flex-col gap-1.5 md:gap-3.5">
              <StatusChip tone="draft" label="Rascunho" className="bg-surface self-start" />
              <span className="font-heading text-[19px] leading-[1.2] font-semibold md:max-w-[22ch] md:text-[26px] md:leading-[1.15]">
                Continue a Volta de novembro
                <span className="hidden md:inline"> de onde parou</span>
              </span>
              <span className="text-peach-ink text-sm md:text-[15px]">
                <span className="md:hidden">Falta definir a oferta</span>
                <span className="hidden md:inline">
                  Público com 38 clientes já revisado. Falta definir a oferta.
                </span>
              </span>
              <span className="bg-ember mt-auto hidden min-h-12 items-center self-start rounded-full px-[22px] text-[15px] font-semibold text-white md:inline-flex">
                Continuar rascunho
              </span>
            </span>
            <span className="bg-ember flex size-11 flex-none items-center justify-center rounded-full text-white md:hidden">
              <ChevronRight />
            </span>
          </Link>
          <Link
            href="/campaigns/out/results"
            className="bg-leaf text-ink flex items-center gap-3.5 rounded-[20px] p-5 no-underline md:min-h-[180px] md:flex-col md:items-stretch md:rounded-3xl md:p-8"
          >
            <span className="flex flex-auto flex-col gap-1.5 md:gap-3.5">
              <StatusChip
                tone="closed"
                label="Encerrada em 2 de novembro"
                className="bg-surface self-start"
              />
              <span className="font-heading text-[19px] leading-[1.2] font-semibold md:max-w-[22ch] md:text-[26px] md:leading-[1.15]">
                14 dos 40 convidados
                <span className="hidden md:inline"> da Volta de outubro</span> voltaram
              </span>
              <span className="text-mint-ink text-sm md:text-[15px]">
                <span className="md:hidden">Resultado da Volta de outubro</span>
                <span className="hidden md:inline">
                  11 usaram o cupom e 3 voltaram sem ele. Veja o que isso diz e o que não diz.
                </span>
              </span>
              <span className="bg-forest mt-auto hidden min-h-12 items-center self-start rounded-full px-[22px] text-[15px] font-semibold text-white md:inline-flex">
                Ver resultado
              </span>
            </span>
            <span className="bg-forest flex size-11 flex-none items-center justify-center rounded-full text-white md:hidden">
              <ChevronRight />
            </span>
          </Link>
        </section>

        <CampaignList campaigns={DEMO_CAMPAIGNS} />

        {/* Data coverage */}
        <section
          aria-labelledby="dados"
          className="bg-surface border-border rounded-card grid gap-3.5 border p-5 md:grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] md:gap-8 md:p-8"
        >
          <div className="hidden flex-col gap-3 md:flex">
            <h2 id="dados" className="font-heading text-2xl font-semibold">
              De onde vêm esses números
            </h2>
            <p className="text-graphite max-w-[46ch] text-[15px] leading-relaxed">
              Pedidos concluídos e cancelados de {opportunity.historyStartLabel} a 16 de novembro,
              lidos da Cardápio Web. Só dá para reconhecer a recompra quando o pedido tem cliente
              identificado.
            </p>
            {/* The integration screen has no route yet; the link stays in place for fidelity. */}
            <a
              href="#dados"
              className="text-forest hover:text-forest-deep self-start text-[15px] font-semibold"
            >
              Ver o que o Volta acessa na sua loja
            </a>
          </div>
          <div className="flex flex-col gap-3.5 md:gap-4">
            <h3 className="font-heading text-[19px] font-semibold md:font-sans md:text-[15px] md:tracking-normal">
              <span className="md:hidden">Pedidos com cliente identificado</span>
              <span className="hidden md:inline">Pedidos com cliente identificado, por canal</span>
            </h3>
            <ChannelBars />
            <p className="text-graphite text-[13px] leading-normal">
              <span className="hidden md:inline">
                Pedidos de balcão raramente têm cliente. Quem compra só por ali pode aparecer como
                sem pedido.
              </span>
              <span className="md:hidden">
                Quem compra só no balcão, sem se identificar, pode aparecer como sem pedido.
              </span>
            </p>
          </div>
        </section>
      </main>

      <MobileTabBar current="home" />
    </div>
  );
}
