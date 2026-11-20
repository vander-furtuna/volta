"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { FilterPill } from "@/components/ui/filter-pill";
import { StatusChip } from "@/components/ui/status-chip";
import { setAllCustomers, toggleCustomer, useDraftAudience } from "@/demo/campaign-draft";
import {
  DEFAULT_CRITERIA,
  DEMO_CUSTOMERS,
  DEMO_NOW,
  SAMPLE_SIZE,
  type SampleCustomer,
} from "@/demo/wizard-fixture";
import { buildAudience, type ExclusionReason } from "@/domain/audience/audience";
import { daysBetween } from "@/domain/shared/time";
import { cn } from "@/lib/utils";

/**
 * "Público" step: criteria, the explained count and the list of customers with a checkbox each.
 * Counts come from `buildAudience`; the manual selection lives in the campaign draft
 * (`useDraftAudience`), so the review step shows exactly who was kept.
 * Reference: audience.dc.html and mobile-audience.dc.html.
 */

type ListFilter = "all" | "included" | "excluded";

const AUDIENCE = buildAudience(DEMO_CUSTOMERS, DEFAULT_CRITERIA, DEMO_NOW);
const BY_ID = new Map(DEMO_CUSTOMERS.map((customer) => [customer.id, customer]));
const EXCLUSION_BY_ID = new Map(
  AUDIENCE.excluded.map((entry) => [entry.customer.id, entry.reason]),
);
/** Everyone in the opportunity (included + excluded by a rule), template sample first. */
const OPPORTUNITY: SampleCustomer[] = [
  ...AUDIENCE.included,
  ...AUDIENCE.excluded.map((e) => e.customer),
]
  .map((customer) => BY_ID.get(customer.id))
  .filter((customer): customer is SampleCustomer => customer !== undefined)
  .sort((a, b) => a.id - b.id);

const { minCompletedOrders: MIN_ORDERS, minDaysSinceLastOrder: MIN_DAYS } = DEFAULT_CRITERIA;

const EXCLUSION_ROW: Record<ExclusionReason, { desktop: string; mobile: string }> = {
  whatsapp_not_allowed: {
    desktop: "Não autorizaram mensagens no WhatsApp",
    mobile: "WhatsApp não autorizado",
  },
  missing_phone: { desktop: "Sem telefone no cadastro", mobile: "Sem telefone no cadastro" },
  recently_invited: {
    desktop: `Convidados pelo Volta há menos de ${DEFAULT_CRITERIA.minDaysBetweenInvitations} dias`,
    mobile: `Convidados há menos de ${DEFAULT_CRITERIA.minDaysBetweenInvitations} dias`,
  },
};

const SHORT_MONTHS = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "maio",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
];
const LONG_MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function invitedOn(date: Date | null, long: boolean): string {
  if (!date) return "";
  const months = long ? LONG_MONTHS : SHORT_MONTHS;
  return `${date.getDate()} de ${months[date.getMonth()]}`;
}

function exclusionChip(customer: SampleCustomer, reason: ExclusionReason): string {
  switch (reason) {
    case "whatsapp_not_allowed":
      return "Fora: WhatsApp não autorizado";
    case "missing_phone":
      return "Fora: sem telefone";
    case "recently_invited":
      return `Fora: convidado em ${invitedOn(customer.lastInvitedAt, false)}`;
  }
}

function exclusionSentence(customer: SampleCustomer, reason: ExclusionReason): string {
  switch (reason) {
    case "whatsapp_not_allowed":
      return "Não autorizou mensagens no WhatsApp.";
    case "missing_phone":
      return "Sem telefone no cadastro.";
    case "recently_invited":
      return `Convidado em ${invitedOn(customer.lastInvitedAt, true)}.`;
  }
}

function selectedLabel(count: number): string {
  return count === 1 ? "1 cliente selecionado" : `${count} clientes selecionados`;
}

const criteriaInput =
  "tabular border-border-input bg-paper text-forest text-center text-[17px] font-semibold";

/** Criteria value shown like the template's input. Fixed in the demo: the list below is frozen. */
function CriteriaValue({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <input
      readOnly
      aria-label={label}
      title="Critério fixo nos dados de demonstração"
      value={value}
      className={cn(criteriaInput, className)}
    />
  );
}

function SelectBox({
  customer,
  checked,
  className,
}: {
  customer: SampleCustomer;
  checked: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn("flex size-11 flex-none cursor-pointer items-center justify-center", className)}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => toggleCustomer(customer.id)}
        className="accent-forest size-[18px] cursor-pointer"
      />
      <span className="sr-only">Incluir {customer.name} no público</span>
    </label>
  );
}

export function AudienceBuilder() {
  const { eligible, selectedCount, isSelected } = useDraftAudience();
  const [filter, setFilter] = useState<ListFilter>("all");
  const [showAll, setShowAll] = useState(false);

  const eligibleIds = new Set(eligible.map((customer) => customer.id));
  const unchecked = eligible.length - selectedCount;
  const outCount = OPPORTUNITY.length - selectedCount;

  const statusOf = (customer: SampleCustomer) => {
    const reason = EXCLUSION_BY_ID.get(customer.id) ?? null;
    const selectable = eligibleIds.has(customer.id);
    const selected = selectable && isSelected(customer.id);
    return { reason, selectable, selected };
  };

  const filtered = OPPORTUNITY.filter((customer) => {
    if (filter === "all") return true;
    const { selected } = statusOf(customer);
    return filter === "included" ? selected : !selected;
  });
  const desktopRows = showAll ? filtered : filtered.filter((c) => c.id <= SAMPLE_SIZE);
  const mobileRows = showAll ? filtered : filtered.filter((c) => c.showOnMobile);
  const filterTotal =
    filter === "all" ? OPPORTUNITY.length : filter === "included" ? selectedCount : outCount;
  const filterNoun =
    filter === "all"
      ? "clientes da oportunidade"
      : filter === "included"
        ? "clientes no público"
        : "clientes fora do público";

  const chipFor = (customer: SampleCustomer, short: boolean) => {
    const { reason, selected } = statusOf(customer);
    if (selected) return <StatusChip tone="active" label="No público" />;
    if (short) return <StatusChip tone="draft" label="Fora" />;
    return (
      <StatusChip
        tone="draft"
        label={reason ? exclusionChip(customer, reason) : "Fora: desmarcado por você"}
      />
    );
  };

  return (
    <>
      <div className="flex flex-col flex-wrap items-start gap-5 md:flex-row md:gap-6">
        <div className="flex w-full min-w-0 flex-col gap-5 md:flex-[1_1_380px] md:gap-6">
          {/* Criteria */}
          <section
            aria-labelledby="criterio"
            className="bg-surface border-border rounded-card flex flex-col gap-3.5 border p-5 md:gap-[18px] md:p-7"
          >
            <h2 id="criterio" className="font-heading text-[22px] font-semibold">
              Quem entra no público
            </h2>
            <p className="text-ink hidden text-lg leading-[2.3] md:block">
              Clientes com pelo menos{" "}
              <CriteriaValue
                label="Pedidos concluídos mínimos"
                value={String(MIN_ORDERS)}
                className="h-10 w-14 rounded-[10px] border-[1.5px]"
              />{" "}
              pedidos concluídos, sem pedido há mais de{" "}
              <CriteriaValue
                label="Dias sem pedido"
                value={String(MIN_DAYS)}
                className="h-10 w-16 rounded-[10px] border-[1.5px]"
              />{" "}
              dias, olhando os últimos{" "}
              <CriteriaValue
                label="Histórico considerado"
                value="6 meses"
                className="h-10 w-24 rounded-[10px] border-[1.5px]"
              />
              .
            </p>
            <div className="flex flex-col gap-3 md:hidden">
              {(
                [
                  ["Pedidos concluídos, no mínimo", String(MIN_ORDERS)],
                  ["Dias sem pedido, mais de", String(MIN_DAYS)],
                  ["Histórico considerado", "6 meses"],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 text-[15px]">
                  <span aria-hidden="true">{label}</span>
                  <CriteriaValue
                    label={label}
                    value={value}
                    className="rounded-field h-11 w-[88px] flex-none border-[1.5px]"
                  />
                </div>
              ))}
            </div>
            <p className="text-graphite hidden text-sm leading-[1.55] md:block">
              Esses números são um ponto de partida, não uma regra científica. Em uma hamburgueria
              em que o cliente pede toda semana, {MIN_DAYS} dias já é bastante tempo.
            </p>
            <p className="text-graphite text-[13px] leading-[1.55] md:hidden">
              Um ponto de partida, não uma regra. Numa hamburgueria com pedido semanal, {MIN_DAYS}{" "}
              dias já é bastante tempo.
            </p>
          </section>

          {/* How we got to N */}
          <section
            aria-labelledby="conta"
            className="bg-surface border-border rounded-card flex flex-col gap-2.5 border p-5 md:gap-4 md:p-7"
          >
            <h2 id="conta" className="font-heading text-xl font-semibold md:text-[22px]">
              Como chegamos a {selectedCount}
              <span className="hidden md:inline"> clientes</span>
            </h2>
            <dl className="flex flex-col text-sm md:text-[15px]">
              <BreakdownRow
                label={
                  <>
                    <span className="hidden md:inline">Clientes com</span>
                    <span className="md:hidden">Com</span> {MIN_ORDERS} ou mais pedidos
                  </>
                }
                value={AUDIENCE.frequentCustomers}
              />
              <BreakdownRow
                label={`Pediram nos últimos ${MIN_DAYS} dias`}
                value={-AUDIENCE.orderedRecently}
                muted
              />
              <BreakdownRow label="Na oportunidade" value={AUDIENCE.opportunity} strong />
              {AUDIENCE.exclusions.map(({ reason, count }) => (
                <BreakdownRow
                  key={reason}
                  label={
                    <>
                      <span className="hidden md:inline">{EXCLUSION_ROW[reason].desktop}</span>
                      <span className="md:hidden">{EXCLUSION_ROW[reason].mobile}</span>
                    </>
                  }
                  value={-count}
                  muted
                />
              ))}
              {unchecked > 0 && (
                <BreakdownRow label="Desmarcados por você" value={-unchecked} muted />
              )}
              <div className="bg-forest mt-2.5 flex items-center justify-between gap-3 rounded-[14px] px-4 py-3.5 text-white md:mt-3 md:gap-4 md:px-[18px] md:py-4">
                <dt className="font-semibold">
                  No público<span className="hidden md:inline"> desta campanha</span>
                </dt>
                <dd className="font-heading tabular text-sprout text-[26px] font-bold md:text-[28px]">
                  {selectedCount}
                </dd>
              </div>
            </dl>
            <p className="text-graphite hidden text-[13px] leading-[1.55] md:block">
              Convites feitos fora do Volta, como os do CRM da Cardápio Web, não entram nessa conta.
              Se você usa os dois, confira antes de enviar.
            </p>
          </section>
        </div>

        {/* Customer list with selection */}
        <section
          aria-labelledby="amostra"
          className="md:bg-surface md:border-border md:rounded-card flex w-full min-w-0 flex-col gap-3 md:flex-[999_1_560px] md:gap-[18px] md:border md:p-7"
        >
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between">
            <div className="flex flex-col gap-0.5 md:gap-1">
              <h2 id="amostra" className="font-heading text-xl font-semibold md:text-[22px]">
                Confira quem está na lista
              </h2>
              <p className="text-graphite text-[13px] md:text-sm">
                Mostrando <span className="hidden md:inline">{desktopRows.length}</span>
                <span className="md:hidden">{mobileRows.length}</span> dos {filterTotal}{" "}
                {filterNoun}
              </p>
            </div>
            <div
              role="group"
              aria-label="Filtrar lista"
              className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-0.5 md:mx-0 md:flex-wrap md:overflow-visible md:p-0"
            >
              {(
                [
                  ["all", "Todos", OPPORTUNITY.length],
                  ["included", "Incluídos", selectedCount],
                  ["excluded", "Fora", outCount],
                ] as const
              ).map(([id, label, count]) => (
                <FilterPill key={id} pressed={filter === id} onClick={() => setFilter(id)}>
                  {label} <span className="tabular">{count}</span>
                </FilterPill>
              ))}
            </div>
          </div>

          {/* Selection controls */}
          <div className="bg-well rounded-well flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1 pr-1 pl-4">
            <p aria-live="polite" className="tabular text-[15px] font-semibold">
              {selectedLabel(selectedCount)}
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="compact"
                disabled={selectedCount === eligible.length}
                onClick={() => setAllCustomers(true)}
              >
                Selecionar todos
              </Button>
              <Button
                variant="ghost"
                size="compact"
                disabled={selectedCount === 0}
                onClick={() => setAllCustomers(false)}
              >
                Desmarcar todos
              </Button>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="tabular w-full min-w-[660px] border-collapse text-[15px]">
              <thead>
                <tr className="text-graphite text-left text-[13px]">
                  <th scope="col" className="border-border w-11 border-b py-2.5 font-semibold">
                    <span className="sr-only">Incluir</span>
                  </th>
                  <th scope="col" className="border-border border-b py-2.5 pr-3 font-semibold">
                    Cliente
                  </th>
                  <th
                    scope="col"
                    className="border-border border-b px-3 py-2.5 text-right font-semibold"
                  >
                    Pedidos
                  </th>
                  <th
                    scope="col"
                    className="border-border border-b px-3 py-2.5 text-right font-semibold"
                  >
                    Último pedido
                  </th>
                  <th
                    scope="col"
                    className="border-border border-b px-3 py-2.5 text-right font-semibold"
                  >
                    Costuma pedir a cada
                  </th>
                  <th scope="col" className="border-border border-b py-2.5 pl-3 font-semibold">
                    Situação
                  </th>
                </tr>
              </thead>
              <tbody>
                {desktopRows.map((customer) => {
                  const { selectable, selected } = statusOf(customer);
                  return (
                    <tr key={customer.id} className="border-border-soft border-b last:border-b-0">
                      <td className="py-0.5">
                        {selectable && (
                          <SelectBox customer={customer} checked={selected} className="-ml-3" />
                        )}
                      </td>
                      <td className="py-3.5 pr-3 font-semibold">{customer.name}</td>
                      <td className="px-3 py-3.5 text-right">{customer.completedOrders}</td>
                      <td className="px-3 py-3.5 text-right">
                        há {daysBetween(customer.lastOrderAt, DEMO_NOW)} dias
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        {customer.typicalIntervalDays} dias
                      </td>
                      <td className="py-3.5 pl-3">{chipFor(customer, false)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          {mobileRows.length > 0 && (
            <ul className="bg-surface border-border rounded-card flex flex-col border px-4 md:hidden">
              {mobileRows.map((customer) => {
                const { reason, selectable, selected } = statusOf(customer);
                return (
                  <li
                    key={customer.id}
                    className="border-border-soft flex gap-1 border-b py-3.5 last:border-b-0"
                  >
                    {selectable ? (
                      <SelectBox customer={customer} checked={selected} className="-my-2.5 -ml-3" />
                    ) : (
                      <span aria-hidden="true" className="-ml-3 w-11 flex-none" />
                    )}
                    <div className="flex min-w-0 flex-auto flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <b className="text-base">{customer.name}</b>
                        {chipFor(customer, true)}
                      </div>
                      <span className="text-graphite tabular text-[13px]">
                        {customer.completedOrders} pedidos. Último há{" "}
                        {daysBetween(customer.lastOrderAt, DEMO_NOW)} dias.{" "}
                        {reason
                          ? exclusionSentence(customer, reason)
                          : selected
                            ? `Costuma pedir a cada ${customer.typicalIntervalDays} dias.`
                            : "Desmarcado por você."}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!showAll && (
            <Button
              variant="outline"
              fullWidth
              className="md:w-auto md:self-start"
              onClick={() => setShowAll(true)}
            >
              Ver os {OPPORTUNITY.length} clientes
            </Button>
          )}

          <div className="bg-well rounded-well hidden items-start gap-3 px-[18px] py-4 md:flex">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="text-forest mt-px size-5 flex-none"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 8h.01" />
            </svg>
            <p className="text-ink text-sm leading-[1.55]">
              “Costuma pedir a cada” é a mediana entre os pedidos do próprio cliente. Com só 3
              pedidos, é uma pista, não uma previsão. O Volta usa do cadastro só nome, telefone e a
              autorização de WhatsApp.
            </p>
          </div>
        </section>
      </div>

      {/* Action bar: card on desktop, sticky bottom bar on mobile */}
      <div className="bg-surface border-border md:rounded-card sticky bottom-0 z-10 -mx-4 flex flex-col gap-2.5 border-t px-4 pt-3.5 pb-6 md:static md:mx-0 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-5 md:border md:px-6 md:py-5">
        <p className="text-graphite md:text-ink text-[13px] leading-normal md:max-w-[62ch] md:text-[15px]">
          {selectedCount === 0 ? (
            "Selecione ao menos um cliente para continuar."
          ) : (
            <>
              <span className="md:hidden">
                Ao continuar, a lista de {selectedCount} clientes fica congelada para medir quem
                voltou.
              </span>
              <span className="hidden md:inline">
                Ao continuar, a lista de {selectedCount} clientes fica congelada. É ela que usamos
                depois para saber quem voltou, com ou sem cupom.
              </span>
            </>
          )}
        </p>
        <div className="flex flex-col-reverse gap-2.5 md:flex-row md:flex-wrap md:gap-3">
          <Button variant="outline" className="w-full md:w-auto">
            Salvar rascunho
          </Button>
          {selectedCount > 0 ? (
            <Button asChild className="w-full md:w-auto">
              <Link href="/campaigns/new/offer">Congelar público e continuar</Link>
            </Button>
          ) : (
            <Button disabled className="w-full md:w-auto">
              Congelar público e continuar
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function BreakdownRow({
  label,
  value,
  muted = false,
  strong = false,
}: {
  label: ReactNode;
  value: number;
  muted?: boolean;
  strong?: boolean;
}) {
  const formatted = value < 0 ? `−${Math.abs(value)}` : String(value);
  return (
    <div className="border-border-soft flex justify-between gap-3 border-b py-[11px] md:gap-4 md:py-3">
      <dt className={cn(muted && "text-graphite", strong && "font-semibold")}>{label}</dt>
      <dd
        className={cn("tabular", muted ? "text-graphite" : strong ? "font-bold" : "font-semibold")}
      >
        {formatted}
      </dd>
    </div>
  );
}
