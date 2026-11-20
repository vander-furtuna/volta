"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { OFFER_ISSUE_MESSAGE } from "@/copy/pt-BR";
import { updateCampaignDraft, useCampaignDraft, useDraftAudience } from "@/demo/campaign-draft";
import { DEMO_OFFER_CONTEXT } from "@/demo/wizard-fixture";
import {
  type BenefitType,
  canProceedToReview,
  discountExposure,
  normalizeCouponCode,
  type Offer,
  type OfferIssueCode,
  type OrderChannel,
  validateOffer,
} from "@/domain/offer/offer";
import { cn } from "@/lib/utils";
import { brl, weekdayDate, weekdayDay } from "./format";

/**
 * "Oferta e limites" step. A single client component: the form state feeds the domain rules
 * (`validateOffer`, `discountExposure`) and the preview, cost ceiling and warnings update live.
 * Reference: offer.dc.html and mobile-offer.dc.html (including their <script> logic).
 */

const BENEFITS: { type: BenefitType; label: string; hint: string; defaultAmount?: string }[] = [
  {
    type: "fixed_amount",
    label: "Valor fixo",
    hint: "Custo por uso previsível",
    defaultAmount: "10",
  },
  {
    type: "percentage",
    label: "Percentual",
    hint: "Custo varia com o pedido",
    defaultAmount: "15",
  },
  { type: "free_shipping", label: "Frete grátis", hint: "Só para delivery" },
];

const CHANNELS: { channel: OrderChannel; label: string; short: string }[] = [
  { channel: "delivery", label: "Delivery", short: "Delivery" },
  { channel: "takeout", label: "Retirada", short: "Retirada" },
  { channel: "dine_in", label: "Consumo no local", short: "No local" },
];

const inputClass =
  "bg-surface border-border-input text-ink hover:border-graphite/60 rounded-field h-12 w-full border-[1.5px] px-3.5 text-base font-medium";

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      <span className="text-ink text-[13px] font-semibold md:text-sm">{label}</span>
      {children}
    </label>
  );
}

function WarningIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
      className="text-status-pending-ink mt-px hidden size-5 flex-none md:block"
    >
      <path d="M12 3l9.5 17H2.5z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  );
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="bg-peach rounded-well flex items-start gap-3 px-4 py-3.5 md:px-[18px] md:py-4"
    >
      <WarningIcon />
      <p className="text-peach-ink text-sm leading-normal md:leading-[1.55]">{children}</p>
    </div>
  );
}

function InlineWarning({ children }: { children: ReactNode }) {
  return (
    <p className="text-status-pending-ink text-[13px] leading-normal md:text-sm">{children}</p>
  );
}

export function OfferEditor() {
  // The campaign draft is the source of truth, so going back and forth keeps every choice.
  const { offer } = useCampaignDraft();
  const { selectedCount } = useDraftAudience();
  const update = (patch: Partial<Offer>) => updateCampaignDraft({ offer: { ...offer, ...patch } });
  const { benefit, startsOn, endsOn, oncePerCustomer, newCustomersOnly, channels } = offer;
  const code = offer.couponCode ?? "";
  const amount = offer.amount === null ? "" : String(offer.amount);
  const minimum = offer.minimumOrderValue === null ? "" : String(offer.minimumOrderValue);
  const limit = offer.usageLimit === 0 ? "" : String(offer.usageLimit);
  const toAmount = (input: string) => (input === "" ? null : Math.max(0, toNumber(input)));

  const setAmount = (input: string) => update({ amount: toAmount(input) });
  const setMinimum = (input: string) => update({ minimumOrderValue: toAmount(input) });
  const setLimit = (input: string) => update({ usageLimit: Number.parseInt(input, 10) || 0 });
  const setStartsOn = (startsOn: string) => update({ startsOn });
  const setEndsOn = (endsOn: string) => update({ endsOn });
  const setOncePerCustomer = (oncePerCustomer: boolean) => update({ oncePerCustomer });
  const setNewCustomersOnly = (newCustomersOnly: boolean) => update({ newCustomersOnly });
  const setCode = (couponCode: string) => update({ couponCode });
  const pickBenefit = (type: BenefitType, defaultAmount?: string) =>
    update(defaultAmount ? { benefit: type, amount: Number(defaultAmount) } : { benefit: type });
  const context = DEMO_OFFER_CONTEXT;
  const issues = new Set<OfferIssueCode>(validateOffer(offer, context).map((issue) => issue.code));
  const canProceed = canProceedToReview(offer, context);
  const exposure = discountExposure(offer, context);

  const value = offer.amount ?? 0;
  const uses = exposure.basis.uses;
  const minimumValue = offer.minimumOrderValue ?? 0;
  const normalizedCode = normalizeCouponCode(code);
  const ticket = brl(context.audienceAverageOrderValue);
  const endLabel = weekdayDate(endsOn);

  let benefitText: string;
  let benefitShort: string;
  let ceiling: string;
  let ceilingNote: string;
  if (benefit === "fixed_amount") {
    benefitText = `${brl(value)} de desconto`;
    benefitShort = brl(value);
    ceiling = `Até ${brl(exposure.amount)}`;
    ceilingNote = `${brl(value)} × ${uses} usos. Valor fixo deixa o custo de cada uso previsível.`;
  } else if (benefit === "percentage") {
    benefitText = `${value}% de desconto`;
    benefitShort = `${value}%`;
    ceiling = `Cerca de ${brl(exposure.amount)}`;
    ceilingNote = `Estimativa: ${value}% de um pedido médio de ${ticket} × ${uses} usos. Pedidos maiores custam mais; não há teto em reais no cupom.`;
  } else {
    benefitText = "Frete grátis";
    benefitShort = "Frete grátis";
    ceiling = `Cerca de ${brl(exposure.amount)}`;
    ceilingNote = `Estimativa: taxa média de entrega de ${brl(context.averageDeliveryFee)} × ${uses} usos. Varia com a distância.`;
  }
  const customerReading =
    benefitText +
    (minimumValue > 0 ? ` em pedidos a partir de ${brl(minimumValue)}` : "") +
    ". " +
    (normalizedCode
      ? `Use o código ${normalizedCode} até ${endLabel}.`
      : `Aparece para todos no cardápio até ${endLabel}.`);

  const toggleChannel = (channel: OrderChannel, checked: boolean) =>
    update({
      channels: checked
        ? [...channels.filter((item) => item !== channel), channel]
        : channels.filter((item) => item !== channel),
    });

  const fieldsetClass =
    "bg-surface border-border rounded-card flex min-w-0 flex-col gap-3.5 border p-5 md:rounded-none md:border-0 md:bg-transparent md:p-0";
  // `float-left w-full` takes the legend out of the fieldset border so it lays out like a heading.
  const legendClass =
    "font-heading float-left w-full p-0 text-xl font-semibold md:mb-1.5 md:text-[22px]";

  return (
    <>
      <div className="flex flex-col flex-wrap items-start gap-5 md:flex-row md:gap-6">
        <form
          onSubmit={(event) => event.preventDefault()}
          className="md:bg-surface md:border-border md:rounded-card flex w-full min-w-0 flex-col gap-5 md:flex-[999_1_560px] md:gap-7 md:border md:p-8"
        >
          {/* What the customer gets */}
          <fieldset className={fieldsetClass}>
            <legend className={cn(legendClass, "text-[22px]")}>O que o cliente ganha</legend>
            <div
              role="group"
              aria-label="Tipo de benefício"
              className="flex flex-col gap-2 md:flex-row md:flex-wrap md:gap-2.5"
            >
              {BENEFITS.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  aria-pressed={benefit === item.type}
                  onClick={() => pickBenefit(item.type, item.defaultAmount)}
                  className="group bg-surface border-border text-ink aria-pressed:bg-forest aria-pressed:border-forest rounded-field flex min-h-[52px] flex-col items-start gap-[3px] border-[1.5px] px-3 py-2 text-left text-[15px] leading-[1.2] font-semibold aria-pressed:text-white md:flex-1"
                >
                  {item.label}
                  <small className="text-graphite group-aria-pressed:text-sprout text-xs font-medium">
                    {item.hint}
                  </small>
                </button>
              ))}
            </div>
            <div className="mt-0 grid grid-cols-2 gap-3 md:mt-2 md:grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] md:gap-4">
              {benefit !== "free_shipping" && (
                <Field
                  label={
                    benefit === "percentage"
                      ? "Percentual de desconto (%)"
                      : "Valor do desconto (R$)"
                  }
                >
                  <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className={cn(inputClass, "tabular")}
                  />
                </Field>
              )}
              <Field label="Pedido mínimo (R$)">
                <input
                  type="number"
                  min={0}
                  value={minimum}
                  onChange={(event) => setMinimum(event.target.value)}
                  className={cn(inputClass, "tabular")}
                />
              </Field>
            </div>
            {issues.has("invalid_amount") && (
              <InlineWarning>{OFFER_ISSUE_MESSAGE.invalid_amount}</InlineWarning>
            )}
            {issues.has("minimum_above_average_order") ? (
              <InlineWarning>
                <span className="hidden md:inline">
                  Esse mínimo fica acima do pedido médio do público ({ticket}). Menos clientes vão
                  conseguir usar.
                </span>
                <span className="md:hidden">
                  Acima do pedido médio do público ({ticket}). Menos clientes vão conseguir usar.
                </span>
              </InlineWarning>
            ) : (
              minimumValue > 0 && (
                <p className="text-graphite text-[13px] leading-normal md:text-sm">
                  O pedido médio desse público é {ticket}.{" "}
                  <span className="hidden md:inline">
                    Com esse mínimo, a maioria dos pedidos habituais se qualifica.
                  </span>
                  <span className="md:hidden">A maioria dos pedidos habituais se qualifica.</span>
                </p>
              )
            )}
          </fieldset>

          {/* How long and how many times */}
          <fieldset className={fieldsetClass}>
            <legend className={legendClass}>Por quanto tempo e quantas vezes</legend>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] md:gap-4">
              <Field label="Começa em">
                <input
                  type="date"
                  value={startsOn}
                  onChange={(event) => setStartsOn(event.target.value)}
                  className={cn(inputClass, "tabular px-2.5 md:px-3.5")}
                />
              </Field>
              <Field label="Termina em">
                <input
                  type="date"
                  value={endsOn}
                  onChange={(event) => setEndsOn(event.target.value)}
                  className={cn(inputClass, "tabular px-2.5 md:px-3.5")}
                />
              </Field>
              <Field label="Limite de usos" className="col-span-2 md:col-span-1">
                <input
                  type="number"
                  min={1}
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  className={cn(inputClass, "tabular")}
                />
              </Field>
            </div>
            {issues.has("invalid_period") && (
              <InlineWarning>{OFFER_ISSUE_MESSAGE.invalid_period}</InlineWarning>
            )}
            {issues.has("invalid_usage_limit") && (
              <InlineWarning>{OFFER_ISSUE_MESSAGE.invalid_usage_limit}</InlineWarning>
            )}
            <p className="text-graphite text-[13px] leading-normal md:text-sm">
              <span className="hidden md:inline">
                Vale de {weekdayDate(startsOn)}, até {endLabel}, às 23:59. O limite conta usos de
                qualquer pessoa que tiver o código.
              </span>
              <span className="md:hidden">
                Vale de {weekdayDay(startsOn)}, até {endLabel}, às 23:59. O limite conta usos de
                qualquer pessoa com o código.
              </span>
            </p>

            <div className="border-border-soft flex items-center justify-between gap-3 border-t pt-3.5 md:gap-4 md:pb-3.5">
              <div className="flex flex-col gap-0.5">
                <span id="lbl-uma" className="text-[15px] font-semibold">
                  Uma vez por cliente
                </span>
                <span className="text-graphite text-[13px] md:text-sm">
                  <span className="hidden md:inline">
                    Evita que a mesma pessoa use o desconto em todos os pedidos.
                  </span>
                  <span className="md:hidden">
                    Evita que a mesma pessoa use em todos os pedidos.
                  </span>
                </span>
              </div>
              <Switch
                checked={oncePerCustomer}
                onCheckedChange={setOncePerCustomer}
                aria-labelledby="lbl-uma"
              />
            </div>
            {issues.has("multiple_uses_per_customer") && (
              <InlineWarning>{OFFER_ISSUE_MESSAGE.multiple_uses_per_customer}</InlineWarning>
            )}

            <div className="border-border-soft flex items-center justify-between gap-3 border-t pt-3.5 md:gap-4 md:pb-3.5">
              <div className="flex flex-col gap-0.5">
                <span id="lbl-novos" className="text-[15px] font-semibold">
                  Só para novos clientes
                </span>
                <span className="text-graphite text-[13px] md:text-sm">
                  <span className="hidden md:inline">
                    Restringe o cupom a quem nunca comprou na loja.
                  </span>
                  <span className="md:hidden">Só vale para quem nunca comprou na loja.</span>
                </span>
              </div>
              <Switch
                checked={newCustomersOnly}
                onCheckedChange={setNewCustomersOnly}
                aria-labelledby="lbl-novos"
              />
            </div>
            {issues.has("new_customers_only_blocks_audience") && (
              <Alert>
                <b>Isso bloqueia todo o seu público.</b> Os {selectedCount} clientes já compraram
                antes, então nenhum conseguiria usar
                <span className="hidden md:inline">
                  {" "}
                  o cupom. Desligue para seguir com uma campanha de recompra.
                </span>
                <span className="md:hidden">. Desligue para seguir.</span>
              </Alert>
            )}
          </fieldset>

          {/* Where and how */}
          <fieldset className={fieldsetClass}>
            <legend className={legendClass}>Onde e como usar</legend>
            <div className="flex flex-wrap gap-2 md:gap-2.5">
              {CHANNELS.map((item) => (
                <label
                  key={item.channel}
                  className="border-border rounded-field flex min-h-11 cursor-pointer items-center gap-2.5 border-[1.5px] px-3.5 text-[15px]"
                >
                  <input
                    type="checkbox"
                    checked={channels.includes(item.channel)}
                    onChange={(event) => toggleChannel(item.channel, event.target.checked)}
                    className="accent-forest size-[18px]"
                  />
                  <span className="hidden md:inline">{item.label}</span>
                  <span className="md:hidden">{item.short}</span>
                </label>
              ))}
            </div>
            {issues.has("free_shipping_without_delivery") && (
              <Alert>{OFFER_ISSUE_MESSAGE.free_shipping_without_delivery}</Alert>
            )}
            <Field label="Código do cupom" className="md:max-w-[360px]">
              <input
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s/g, ""))}
                autoComplete="off"
                autoCapitalize="characters"
                className={cn(inputClass, "font-bold tracking-[.04em]")}
              />
            </Field>
            {issues.has("missing_coupon_code") && (
              <Alert>
                <b>Sem código, o cupom aparece para todos no cardápio.</b>
                <span className="hidden md:inline">
                  {" "}
                  Qualquer cliente poderia usar, não só os {selectedCount} convidados.
                </span>{" "}
                Escreva um código para manter o convite direcionado.
              </Alert>
            )}
          </fieldset>
        </form>

        {/* Preview and cost */}
        <aside
          aria-label="Prévia e custo"
          className="bg-forest flex w-full min-w-0 flex-col gap-[18px] self-stretch rounded-[24px] p-5 text-white md:flex-[1_1_360px] md:gap-6 md:self-start md:p-7"
        >
          <div className="flex flex-col gap-[18px] md:gap-3">
            <h2 className="text-sprout text-sm font-semibold md:text-[15px]">
              Como o cliente vai ler
            </h2>
            <div className="text-ink flex flex-col overflow-hidden rounded-2xl bg-white md:rounded-[18px]">
              <div className="flex flex-col gap-1.5 px-[18px] py-4 md:gap-2 md:px-[22px] md:pt-5 md:pb-[18px]">
                <span className="font-heading tabular text-ember text-[34px] leading-none font-bold md:text-[40px]">
                  {benefitShort}
                </span>
                <p className="text-sm leading-normal md:text-[15px]">{customerReading}</p>
              </div>
              <div className="bg-paper border-border flex items-center justify-between border-t-2 border-dashed px-[18px] py-3 md:px-[22px] md:py-3.5">
                <span className="text-graphite text-[13px]">Código</span>
                <span className="font-heading text-forest text-lg font-bold tracking-[.06em] md:text-xl">
                  {normalizedCode ?? "Sem código"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 md:gap-2 md:pt-1">
            <h2 className="text-sprout text-sm font-semibold md:text-[15px]">
              Quanto este cupom pode custar
            </h2>
            <p className="font-heading tabular text-[28px] leading-[1.15] font-semibold md:text-[34px] md:leading-[1.1]">
              {ceiling}{" "}
              <span className="text-base font-medium text-white/80 md:text-lg">em descontos</span>
            </p>
            <p className="text-[13px] leading-normal text-white/80 md:text-sm md:leading-[1.55]">
              {ceilingNote}
              <span className="md:hidden"> Não inclui mensagens nem o custo da comida.</span>
            </p>
            <p className="hidden text-sm leading-[1.55] text-white/80 md:block">
              Não inclui mensagens, outras promoções ativas nem o custo da comida.
            </p>
          </div>
          <div className="mt-auto hidden flex-col gap-2.5 md:flex">
            {canProceed ? (
              <Button asChild fullWidth>
                <Link href="/campaigns/new/review">Revisar antes de criar</Link>
              </Button>
            ) : (
              <Button disabled fullWidth className="bg-white/15 text-white/75 disabled:opacity-100">
                Resolva os avisos para revisar
              </Button>
            )}
            <Button variant="onDark" fullWidth>
              Salvar rascunho
            </Button>
          </div>
        </aside>
      </div>

      {/* Mobile action bar */}
      <div className="bg-surface border-border sticky bottom-0 z-10 -mx-4 flex flex-col gap-2.5 border-t px-4 pt-3.5 pb-6 md:hidden">
        {canProceed ? (
          <Button asChild fullWidth>
            <Link href="/campaigns/new/review">Revisar antes de criar</Link>
          </Button>
        ) : (
          <Button disabled fullWidth className="bg-border-soft text-graphite disabled:opacity-100">
            Resolva os avisos para revisar
          </Button>
        )}
        <Button variant="outline" fullWidth>
          Salvar rascunho
        </Button>
      </div>
    </>
  );
}
