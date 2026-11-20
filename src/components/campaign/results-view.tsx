import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CampaignStatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/utils";
import { CouponOrdersList } from "./coupon-orders-list";
import { OrderTagChip } from "./order-tag-chip";
import { RESULTS as c } from "./results-model";
import { UsesPerDayChart } from "./uses-per-day-chart";

/**
 * Campaign results. Reference: design/templates/source/results.dc.html and mobile-results.dc.html.
 * Keeps the three layers apart: measured (coupon orders), observed (who came back) and
 * not measured (causal effect).
 */

const REPEAT_HREF = "/campaigns/new/audience";
const { usePct, discountPct, returnPct } = c;
const canceledLabel = `${c.canceledExcluded} ${c.canceledExcluded === 1 ? "cancelado" : "cancelados"}`;
const whoReturnedLabel = `Dos ${c.invited} convidados: ${c.returnedWithCoupon} voltaram usando o cupom, ${c.returnedWithoutCoupon} voltaram sem o cupom e ${c.noIdentifiedOrder} não têm pedido identificado`;

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("text-sprout shrink-0", className)}
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function QuestionIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
      className={cn("shrink-0 text-white/70", className)}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4M12 17h.01" />
    </svg>
  );
}

function Meter({ pct, thin }: { pct: number; thin?: boolean }) {
  const h = thin ? "h-1.5" : "h-2";
  return (
    <div
      aria-hidden="true"
      className={cn("bg-chart-rest rounded-full", h, thin ? "mt-1" : "mt-1.5")}
    >
      <div className={cn("bg-chart-primary rounded-full", h)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Stat({
  label,
  value,
  children,
  compact,
  className,
}: {
  label: string;
  value: string;
  children: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-well flex flex-col",
        compact ? "gap-1 rounded-2xl p-4" : "gap-1.5 rounded-[18px] p-[22px]",
        className,
      )}
    >
      <span className={cn("font-semibold", compact ? "text-[13px]" : "text-sm")}>{label}</span>
      <span
        className={cn(
          "font-heading tabular text-forest leading-[1.1] font-semibold",
          compact ? "text-[32px]" : "text-[40px]",
        )}
      >
        {value}
      </span>
      {children}
    </div>
  );
}

function WhoReturnedBar({ compact, label }: { compact?: boolean; label: string }) {
  return (
    <div role="img" aria-label={label} className={cn("flex gap-0.5", compact ? "h-9" : "h-11")}>
      <div
        className="bg-chart-primary rounded-l-md"
        style={{ flex: `${c.returnedWithCoupon} 1 0` }}
      />
      <div className="bg-chart-secondary" style={{ flex: `${c.returnedWithoutCoupon} 1 0` }} />
      <div className="bg-chart-rest rounded-r-md" style={{ flex: `${c.noIdentifiedOrder} 1 0` }} />
    </div>
  );
}

function Legend({ compact }: { compact?: boolean }) {
  const items = [
    { swatch: "bg-chart-primary", value: c.returnedWithCoupon, text: "voltaram com o cupom" },
    { swatch: "bg-chart-secondary", value: c.returnedWithoutCoupon, text: "voltaram sem o cupom" },
    {
      swatch: "bg-chart-rest shadow-[inset_0_0_0_1px_var(--color-border-input)]",
      value: c.noIdentifiedOrder,
      text: "sem pedido identificado",
    },
  ];
  return (
    <div className={cn("flex text-sm", compact ? "flex-col gap-2" : "flex-wrap gap-7")}>
      {items.map((item) => (
        <span key={item.text} className="flex items-center gap-2">
          <span aria-hidden="true" className={cn("size-3 rounded-[3px]", item.swatch)} />
          <b className="tabular">{item.value}</b> {item.text}
        </span>
      ))}
    </div>
  );
}

const cell = "border-border-soft border-b px-3 py-3.5";

function OrdersTable() {
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full min-w-[760px] border-collapse text-[15px]">
        <thead>
          <tr className="text-graphite text-left text-[13px]">
            {["Pedido", "Data", "Cliente", "Canal", "Desconto", "Total pago", "Na conta como"].map(
              (head, index) => (
                <th
                  key={head}
                  scope="col"
                  className={cn(
                    "border-border border-b px-3 py-2.5 font-semibold",
                    index === 0 && "pl-0",
                    index === 6 && "pr-0",
                    (index === 4 || index === 5) && "text-right",
                  )}
                >
                  {head}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {c.desktopOrders.map((order, index) => {
            const canceled = order.tag === "canceled";
            const last = index === c.desktopOrders.length - 1;
            const td = cn(cell, last && "border-b-0");
            const Strike = canceled ? "s" : "span";
            return (
              <tr key={order.number} className={cn(canceled && "text-graphite")}>
                <td className={cn(td, "pl-0 font-semibold")}>
                  <Strike>{order.number}</Strike>
                </td>
                <td className={td}>{order.date}</td>
                <td className={cn(td, !order.customer && "text-graphite")}>
                  {order.customer ?? "Sem identificação"}
                </td>
                <td className={td}>{order.channel}</td>
                <td className={cn(td, "text-right")}>
                  <Strike>{order.discount}</Strike>
                </td>
                <td className={cn(td, "text-right")}>
                  <Strike>{order.total}</Strike>
                </td>
                <td className={cn(td, "pr-0")}>
                  <OrderTagChip order={order} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const textareaClass =
  "border-border-input text-ink rounded-field resize-y border-[1.5px] text-[15px] placeholder:text-graphite/80";

export function ResultsView() {
  return (
    <>
      {/* Desktop (1440 px template) */}
      <main className="max-w-content mx-auto hidden w-full flex-col gap-7 px-8 pt-7 pb-24 md:flex">
        <div className="flex flex-col gap-3.5">
          <Link
            href="/"
            className="text-forest hover:text-forest-deep -my-1.5 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold no-underline"
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
            <h1 className="font-heading text-[38px] font-semibold">{c.name}</h1>
            <CampaignStatusChip status="closed" />
          </div>
          <p className="text-graphite text-[15px]">
            Cupom válido de 27 de outubro a 2 de novembro. Retorno acompanhado até 9 de novembro.
            Atualizado hoje às 19:24.
          </p>
        </div>

        <section
          aria-labelledby="leitura"
          className="bg-forest rounded-panel flex flex-wrap gap-7 px-10 py-9 text-white"
        >
          <div className="flex flex-[1_1_300px] flex-col gap-2.5">
            <h2
              id="leitura"
              className="font-heading max-w-[22ch] text-[30px] leading-[1.15] font-semibold"
            >
              O que dá para afirmar, e o que ainda não
            </h2>
          </div>
          <ul className="flex flex-[2_1_520px] flex-col gap-3.5 text-base leading-normal">
            <li className="flex gap-3">
              <CheckIcon className="size-[22px]" />
              <span>
                <b>Medido:</b> o cupom foi usado em {c.couponOrders} pedidos e custou R${" "}
                {c.discountGiven} em descontos.
              </span>
            </li>
            <li className="flex gap-3">
              <CheckIcon className="size-[22px]" />
              <span>
                <b>Observado:</b> {c.returned} dos {c.invited} convidados voltaram a pedir,{" "}
                {c.returnedWithoutCoupon} deles sem usar o cupom.
              </span>
            </li>
            <li className="flex gap-3">
              <QuestionIcon className="size-[22px]" />
              <span>
                <b>Não medido:</b> quantos voltariam mesmo sem o convite. Sem grupo de comparação,
                não dá para chamar isso de venda recuperada.
              </span>
            </li>
          </ul>
        </section>

        <section
          aria-labelledby="uso"
          className="bg-surface border-border rounded-card flex flex-col gap-7 border p-8"
        >
          <div className="flex flex-col gap-1.5">
            <h2 id="uso" className="font-heading text-2xl font-semibold">
              Uso do cupom
            </h2>
            <p className="text-graphite text-[15px]">
              Pedidos concluídos com o cupom {c.couponCode} (nº {c.cwCouponNumber}), de qualquer
              cliente.
            </p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
            <Stat label="Pedidos com o cupom" value={String(c.couponOrders)}>
              <Meter pct={usePct} />
              <span className="text-graphite tabular text-[13px]">
                de {c.maxUses} usos permitidos
              </span>
            </Stat>
            <Stat label="Desconto concedido" value={`R$ ${c.discountGiven}`}>
              <Meter pct={discountPct} />
              <span className="text-graphite tabular text-[13px]">
                de até R$ {c.discountCeiling}, pago pela loja
              </span>
            </Stat>
            <Stat label="Valor desses pedidos" value={c.ordersValue}>
              <span className="text-graphite mt-1.5 text-[13px] leading-normal">
                Total pago pelos clientes, já com o desconto. Não é lucro: não desconta comida,
                taxas e entrega.
              </span>
            </Stat>
          </div>
          <figure className="flex flex-col gap-2.5">
            <figcaption className="text-base font-semibold">
              Sexta e sábado concentraram metade dos usos
            </figcaption>
            <UsesPerDayChart days={c.usesPerDay} className="block h-auto w-full max-w-[720px]" />
          </figure>
        </section>

        <section
          aria-labelledby="voltou"
          className="bg-surface border-border rounded-card flex flex-col gap-[22px] border p-8"
        >
          <div className="flex flex-col gap-1.5">
            <h2 id="voltou" className="font-heading text-2xl font-semibold">
              Quem voltou
            </h2>
            <p className="text-graphite text-[15px]">
              Os {c.invited} clientes congelados no público, com qualquer pedido identificado até 9
              de novembro.
            </p>
          </div>
          <p className="font-heading text-[26px] leading-[1.25] font-medium">
            <span className="tabular font-bold">
              {c.returned} de {c.invited}
            </span>{" "}
            convidados voltaram a pedir ({returnPct}%)
          </p>
          <WhoReturnedBar label={`${whoReturnedLabel} no período.`} />
          <Legend />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4">
            <div className="bg-peach text-peach-ink rounded-2xl px-5 py-[18px] text-sm leading-[1.55]">
              <b>O código circulou.</b> Dos {c.couponOrders} pedidos com cupom,{" "}
              {c.ordersFromNonInvited} vieram de clientes fora da lista e {c.ordersWithoutCustomer}{" "}
              de um pedido sem cliente identificado.
            </div>
            <div className="bg-well text-ink rounded-2xl px-5 py-[18px] text-sm leading-[1.55]">
              <b>Sem pedido identificado não é o mesmo que não voltou.</b> Quem pediu no balcão sem
              se identificar não aparece aqui.
            </div>
          </div>
        </section>

        <section
          aria-labelledby="efeito"
          className="border-border-input rounded-card flex flex-wrap items-center justify-between gap-6 border-2 border-dashed p-8"
        >
          <div className="flex flex-[1_1_520px] flex-col gap-2">
            <h2 id="efeito" className="font-heading text-2xl font-semibold">
              Efeito da campanha: não medido
            </h2>
            <p className="text-graphite max-w-[70ch] text-[15px] leading-[1.6]">
              Para estimar quantos voltaram por causa do convite, a próxima campanha pode separar um
              grupo de comparação: parte do público não recebe o convite e comparamos o retorno dos
              dois grupos. Com públicos pequenos, a diferença é uma pista, não uma prova.
            </p>
          </div>
          <Button variant="dark">Usar grupo de comparação na próxima</Button>
        </section>

        <section
          aria-labelledby="pedidos"
          className="bg-surface border-border rounded-card flex flex-col gap-[18px] border p-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="pedidos" className="font-heading text-2xl font-semibold">
                Pedidos com o cupom
              </h2>
              <p className="text-graphite text-sm">
                Mostrando {c.desktopOrders.length} de {c.totalOrdersListed}, incluindo{" "}
                {canceledLabel}
              </p>
            </div>
            <Button variant="outline" className="min-h-11">
              Baixar pedidos (.csv)
            </Button>
          </div>
          <OrdersTable />
          <details className="bg-paper rounded-2xl px-5 py-1">
            <summary className="text-forest flex min-h-12 cursor-pointer items-center text-[15px] font-semibold">
              Como calculamos
            </summary>
            <ul className="text-ink mb-[18px] list-disc pl-5 text-sm leading-[1.7]">
              <li>
                Um pedido entra quando o desconto dele aponta para o cupom nº {c.cwCouponNumber},
                não pelo nome do cupom.
              </li>
              <li>O total do pedido já vem com o desconto aplicado. Não subtraímos de novo.</li>
              <li>
                Pedidos cancelados saem da conta quando a Cardápio Web avisa a mudança de status, e
                os números são refeitos.
              </li>
              <li>Descontos pagos pelo iFood não entram no custo da loja.</li>
            </ul>
          </details>
        </section>

        <section
          aria-labelledby="aprendizado"
          className="bg-surface border-border rounded-card flex flex-wrap gap-7 border p-8"
        >
          <div className="flex flex-[1_1_360px] flex-col gap-2">
            <h2 id="aprendizado" className="font-heading text-2xl font-semibold">
              O que muda na próxima
            </h2>
            <p className="text-graphite text-[15px] leading-[1.6]">
              Uma frase basta. Ela aparece quando você criar a próxima campanha de recompra.
            </p>
          </div>
          <div className="flex flex-[2_1_480px] flex-col gap-3.5">
            <label htmlFor="nota" className="sr-only">
              Aprendizado da campanha
            </label>
            <textarea
              id="nota"
              rows={3}
              placeholder="Ex.: o código vazou para fora da lista; na próxima, limitar a 15 usos e testar grupo de comparação."
              className={cn(textareaClass, "px-4 py-3.5 leading-[1.6]")}
            />
            <div className="flex flex-wrap gap-3">
              <Button variant="outline">Salvar aprendizado</Button>
              <Button asChild>
                <Link href={REPEAT_HREF}>Repetir com ajustes</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile (390 px template) */}
      <p className="bg-status-paused text-status-paused-ink px-4 py-1.5 text-center text-xs font-semibold md:hidden">
        Dados de demonstração
      </p>
      <main className="flex flex-col gap-5 px-4 pt-4 pb-28 md:hidden">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-[28px] font-semibold">{c.name}</h1>
            <CampaignStatusChip status="closed" />
          </div>
          <p className="text-graphite text-sm leading-normal">
            Cupom de 27 de outubro a 2 de novembro. Retorno acompanhado até 9 de novembro.
          </p>
        </div>

        <section
          aria-labelledby="m-leitura"
          className="bg-forest flex flex-col gap-3.5 rounded-[24px] px-5 py-[22px] text-white"
        >
          <h2 id="m-leitura" className="font-heading text-[22px] leading-[1.2] font-semibold">
            O que dá para afirmar, e o que ainda não
          </h2>
          <ul className="flex flex-col gap-3 text-[15px] leading-normal">
            <li className="flex gap-2.5">
              <CheckIcon className="mt-0.5 size-5" />
              <span>
                <b>Medido:</b> cupom usado em {c.couponOrders} pedidos, R$ {c.discountGiven} em
                descontos.
              </span>
            </li>
            <li className="flex gap-2.5">
              <CheckIcon className="mt-0.5 size-5" />
              <span>
                <b>Observado:</b> {c.returned} dos {c.invited} convidados voltaram,{" "}
                {c.returnedWithoutCoupon} sem usar o cupom.
              </span>
            </li>
            <li className="flex gap-2.5">
              <QuestionIcon className="mt-0.5 size-5" />
              <span>
                <b>Não medido:</b> quantos voltariam sem o convite.
              </span>
            </li>
          </ul>
        </section>

        <section
          aria-labelledby="m-uso"
          className="bg-surface border-border rounded-card flex flex-col gap-4 border p-5"
        >
          <div className="flex flex-col gap-1">
            <h2 id="m-uso" className="font-heading text-[21px] font-semibold">
              Uso do cupom
            </h2>
            <p className="text-graphite text-[13px]">
              Pedidos concluídos com o {c.couponCode}, de qualquer cliente.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Stat compact label="Pedidos" value={String(c.couponOrders)}>
              <Meter pct={usePct} thin />
              <span className="text-graphite tabular text-xs">de {c.maxUses} usos</span>
            </Stat>
            <Stat compact label="Desconto" value={`R$ ${c.discountGiven}`}>
              <Meter pct={discountPct} thin />
              <span className="text-graphite tabular text-xs">de até R$ {c.discountCeiling}</span>
            </Stat>
            <Stat
              compact
              label="Valor desses pedidos"
              value={c.ordersValueExact}
              className="col-span-2"
            >
              <span className="text-graphite text-xs leading-normal">
                Já com desconto. Não é lucro: não desconta comida, taxas e entrega.
              </span>
            </Stat>
          </div>
          <figure className="flex flex-col gap-2">
            <figcaption className="text-[15px] font-semibold">
              Sexta e sábado concentraram metade dos usos
            </figcaption>
            <UsesPerDayChart compact days={c.usesPerDay} className="block h-auto w-full" />
          </figure>
        </section>

        <section
          aria-labelledby="m-voltou"
          className="bg-surface border-border rounded-card flex flex-col gap-3.5 border p-5"
        >
          <h2 id="m-voltou" className="font-heading text-[21px] font-semibold">
            Quem voltou
          </h2>
          <p className="font-heading text-[22px] leading-[1.25] font-medium">
            <span className="tabular font-bold">
              {c.returned} de {c.invited}
            </span>{" "}
            convidados voltaram a pedir ({returnPct}%)
          </p>
          <WhoReturnedBar compact label={`${whoReturnedLabel}.`} />
          <Legend compact />
          <div className="bg-peach text-peach-ink rounded-well px-4 py-3.5 text-sm leading-normal">
            <b>O código circulou.</b> {c.ordersFromNonInvited} pedidos com cupom vieram de clientes
            fora da lista e {c.ordersWithoutCustomer} de pedido sem cliente identificado.
          </div>
          <div className="bg-well text-ink rounded-well px-4 py-3.5 text-sm leading-normal">
            <b>Sem pedido identificado não é o mesmo que não voltou.</b> Quem pediu no balcão sem se
            identificar não aparece aqui.
          </div>
        </section>

        <section
          aria-labelledby="m-efeito"
          className="border-border-input rounded-card flex flex-col gap-3 border-2 border-dashed p-5"
        >
          <h2 id="m-efeito" className="font-heading text-[21px] font-semibold">
            Efeito da campanha: não medido
          </h2>
          <p className="text-graphite text-sm leading-[1.6]">
            Na próxima, parte do público pode ficar sem convite para comparar o retorno dos dois
            grupos. Com públicos pequenos, a diferença é uma pista, não uma prova.
          </p>
          <Button variant="dark" fullWidth>
            Usar grupo de comparação
          </Button>
        </section>

        <section aria-labelledby="m-pedidos" className="flex flex-col gap-3">
          <h2 id="m-pedidos" className="font-heading text-[21px] font-semibold">
            Pedidos com o cupom
          </h2>
          <CouponOrdersList
            preview={c.mobileOrders}
            all={c.allOrders}
            canceledCount={c.canceledExcluded}
          />
        </section>

        <section
          aria-labelledby="m-aprend"
          className="bg-surface border-border rounded-card flex flex-col gap-3 border p-5"
        >
          <h2 id="m-aprend" className="font-heading text-[21px] font-semibold">
            O que muda na próxima
          </h2>
          <label htmlFor="m-nota" className="text-graphite text-sm leading-normal">
            Uma frase basta. Ela aparece quando você criar a próxima campanha.
          </label>
          <textarea
            id="m-nota"
            rows={3}
            placeholder="Ex.: limitar a 15 usos e testar grupo de comparação."
            className={cn(textareaClass, "px-3.5 py-3 leading-[1.55]")}
          />
          <Button asChild fullWidth>
            <Link href={REPEAT_HREF}>Repetir com ajustes</Link>
          </Button>
          <Button variant="outline" fullWidth>
            Salvar aprendizado
          </Button>
        </section>
      </main>
    </>
  );
}
