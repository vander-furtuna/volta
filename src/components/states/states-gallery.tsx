import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StateCard, StateIcon, StateText } from "./state-card";

/**
 * "Estados e exceções" (design/templates/source/states.dc.html). Each state explains what
 * happened and the next step; no partial number is shown as complete. Actions are illustrative.
 */
export function StatesGallery() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pt-8 pb-16 md:px-16 md:pt-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-forest text-[32px] font-semibold md:text-[40px]">
          Estados e exceções
        </h1>
        <p className="text-graphite max-w-[72ch] text-[17px] leading-[1.55]">
          Cada tela explica o que aconteceu e o próximo passo. Nenhum número parcial aparece como
          completo.
        </p>
      </div>

      <div
        role="status"
        className="bg-status-paused flex flex-wrap items-center gap-3.5 rounded-2xl px-5 py-4"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className="text-status-paused-ink size-[22px] shrink-0"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <p className="text-status-paused-ink flex-[1_1_280px] text-[15px] md:flex-[1_1_500px]">
          <b>Dados atualizados pela última vez às 16:10.</b> A Cardápio Web não respondeu nas
          últimas tentativas. Os números abaixo podem não incluir pedidos recentes.
        </p>
        <Button variant="outline" className="min-h-11">
          Atualizar agora
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StateCard
          titleId="st-importing"
          eyebrow="Primeira sincronização"
          title="Importando seu histórico de pedidos"
          icon={
            <StateIcon tone="active">
              <path d="M21 12a9 9 0 1 1-3-6.7" />
              <path d="M21 4v5h-5" />
            </StateIcon>
          }
        >
          <div
            role="progressbar"
            aria-label="Meses de histórico importados"
            aria-valuemin={0}
            aria-valuemax={6}
            aria-valuenow={3}
            className="bg-status-draft h-2 rounded-full"
          >
            <div className="bg-chart-primary h-2 w-1/2 rounded-full" />
          </div>
          <StateText>
            3 de 6 meses importados. As sugestões de público aparecem quando terminar, para não
            mostrar contas pela metade.
          </StateText>
          <p className="text-status-active-ink text-sm font-semibold">
            Pode fechar esta aba. Continuamos em segundo plano.
          </p>
        </StateCard>

        <StateCard
          titleId="st-little-history"
          eyebrow="Histórico insuficiente"
          title="Ainda há pouco histórico para sugerir um público"
          icon={
            <StateIcon tone="draft">
              <path d="M4 19V5M4 19h16M8 15v-3M12 15V9M16 15v-5" />
            </StateIcon>
          }
          actions={
            <>
              <Button variant="dark" className="min-h-11">
                Escolher clientes
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/campaigns/new/audience">Mudar critério</Link>
              </Button>
            </>
          }
        >
          <StateText>
            Só 9 clientes têm 3 ou mais pedidos identificados. Você pode montar uma campanha
            escolhendo os clientes à mão.
          </StateText>
        </StateCard>

        <StateCard
          titleId="st-nobody"
          eyebrow="Nenhum cliente no público"
          title="Ninguém entra com esse critério agora"
          icon={
            <StateIcon tone="draft">
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
              <path d="M17 8l4 4M21 8l-4 4" />
            </StateIcon>
          }
          actions={
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/campaigns/new/audience">Mudar critério</Link>
            </Button>
          }
        >
          <StateText>
            Os 4 clientes que passariam foram convidados há menos de 14 dias. Espere até 24 de
            novembro ou ajuste o critério.
          </StateText>
        </StateCard>

        <StateCard
          titleId="st-no-access"
          eyebrow="Acesso ausente"
          title="O Volta não tem acesso aos cupons desta loja"
          icon={
            <StateIcon tone="pending">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </StateIcon>
          }
          actions={
            <Button variant="dark" className="min-h-11">
              Ver como reinstalar
            </Button>
          }
        >
          <StateText>
            Sem esse acesso, não dá para criar o cupom. O proprietário precisa reinstalar o app na
            CW App Store e autorizar Cupons.
          </StateText>
        </StateCard>

        <StateCard
          titleId="st-failed"
          eyebrow="Falha ao criar"
          title="Não conseguimos criar o cupom"
          icon={
            <StateIcon tone="pending" strokeWidth={2.2}>
              <path d="M12 3l9.5 17H2.5z" />
              <path d="M12 10v4M12 17h.01" />
            </StateIcon>
          }
          actions={
            <>
              <Button className="min-h-11">Tentar de novo</Button>
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/campaigns/new/review">Voltar ao rascunho</Link>
              </Button>
            </>
          }
        >
          <StateText>
            A Cardápio Web não respondeu a tempo. Seu rascunho está salvo. Antes de tentar de novo,
            conferimos se o cupom já existe para não criar dois.
          </StateText>
        </StateCard>

        <StateCard
          titleId="st-wrong-store"
          eyebrow="Loja diferente"
          title="Você entrou pela unidade Centro"
          icon={
            <StateIcon tone="pending">
              <path d="M3 9l1.5-5h15L21 9" />
              <path d="M4 9v11h16V9" />
              <path d="M9 20v-6h6v6" />
            </StateIcon>
          }
          actions={
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/">Ver campanhas da Centro</Link>
            </Button>
          }
        >
          <StateText>
            Esta campanha é da unidade Aldeota. Para não criar o cupom na loja errada, abra o Volta
            pelo botão Acessar da unidade Aldeota.
          </StateText>
        </StateCard>
      </div>
    </main>
  );
}
