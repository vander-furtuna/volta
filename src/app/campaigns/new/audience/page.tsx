import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Placeholder. Reference: design/templates/html/audience.html and mobile-audience.html. */
export default function AudiencePage() {
  return (
    <main className="max-w-content mx-auto flex w-full flex-col gap-6 px-4 py-8 md:px-8">
      <h1 className="font-heading text-[30px] font-semibold md:text-[38px]">
        Quem entra no público
      </h1>
      <p className="text-graphite max-w-[60ch]">
        Tela em construção. Siga o template de referência em design/templates/html/audience.html.
      </p>
      <Button asChild variant="outline" className="self-start">
        <Link href="/">Voltar ao início</Link>
      </Button>
    </main>
  );
}
