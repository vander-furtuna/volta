import { StateCard, StateIcon, StateText } from "./state-card";

export function StoreAccessState({ blocked }: { blocked: boolean }) {
  return (
    <main className="bg-paper flex min-h-screen items-center justify-center p-4">
      <StateCard
        titleId="store-access"
        headingLevel="h1"
        eyebrow="Volta · Cardápio Web"
        title={blocked ? "Esta loja está sem acesso ao Volta" : "Acesse pela Cardápio Web"}
        icon={
          <StateIcon tone="pending">
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </StateIcon>
        }
      >
        <StateText>
          {blocked
            ? "Confira o acesso da sua loja na App Store da Cardápio Web."
            : "Abra o Volta pela App Store da Cardápio Web para entrar com a sua loja."}
        </StateText>
      </StateCard>
    </main>
  );
}
