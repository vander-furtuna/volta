import Link from "next/link";
import { AppHeader } from "@/components/app/app-chrome";
import { StateCard, StateIcon, StateText } from "@/components/states/state-card";
import { Button } from "@/components/ui/button";

export default function CampaignNotFound() {
  return (
    <div className="bg-paper min-h-screen">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[560px] flex-col px-4 pt-10 pb-16 md:pt-16">
        <StateCard
          titleId="campanha-nao-encontrada"
          headingLevel="h1"
          eyebrow="Campanha não encontrada"
          title="Não achamos essa campanha"
          icon={
            <StateIcon tone="draft">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M20 20l-4.4-4.4" />
            </StateIcon>
          }
          actions={
            <Button asChild variant="dark" className="min-h-11">
              <Link href="/">Voltar ao início</Link>
            </Button>
          }
        >
          <StateText>
            O link pode estar incompleto ou a campanha é de outra unidade. As campanhas desta loja
            estão no início.
          </StateText>
        </StateCard>
      </main>
    </div>
  );
}
