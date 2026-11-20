"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitCampaignOffer } from "@/app/campaigns/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { OFFER_ISSUE_MESSAGE } from "@/copy/pt-BR";
import {
  canProceedToReview,
  discountExposure,
  normalizeCouponCode,
  validateOffer,
  type BenefitType,
  type Offer,
  type OfferContext,
  type OfferIssueCode,
  type OrderChannel,
} from "@/domain/offer/offer";
import { cn } from "@/lib/utils";
import { brl, weekdayDate } from "./format";

const BENEFITS: { type: BenefitType; label: string; hint: string; defaultAmount?: number }[] = [
  {
    type: "fixed_amount",
    label: "Valor fixo",
    hint: "Custo por uso previsível",
    defaultAmount: 10,
  },
  { type: "percentage", label: "Percentual", hint: "Custo varia com o pedido", defaultAmount: 15 },
  { type: "free_shipping", label: "Frete grátis", hint: "Só para delivery" },
];

const CHANNELS: { channel: OrderChannel; label: string }[] = [
  { channel: "delivery", label: "Delivery" },
  { channel: "takeout", label: "Retirada" },
  { channel: "dine_in", label: "Consumo no local" },
];

const inputClass =
  "bg-surface border-border-input text-ink rounded-field h-12 w-full border-[1.5px] px-3.5 text-base font-medium";

export function StoreCampaignOffer({
  storeName,
  campaignId,
  campaignName,
  audienceCount,
  initialOffer,
  context,
}: {
  storeName: string;
  campaignId: string;
  campaignName: string;
  audienceCount: number;
  initialOffer: Offer;
  context: OfferContext;
}) {
  const [offer, setOffer] = useState<Offer>(initialOffer);
  const [message, action, pending] = useActionState(submitCampaignOffer, null);

  const update = (patch: Partial<Offer>) => setOffer((prev) => ({ ...prev, ...patch }));
  const issues = new Set<OfferIssueCode>(validateOffer(offer, context).map((issue) => issue.code));
  const canProceed = canProceedToReview(offer, context);
  const exposure = discountExposure(offer, context);
  const normalizedCode = normalizeCouponCode(offer.couponCode);

  const toggleChannel = (channel: OrderChannel, checked: boolean) => {
    update({
      channels: checked
        ? [...offer.channels.filter((item) => item !== channel), channel]
        : offer.channels.filter((item) => item !== channel),
    });
  };

  return (
    <main className="max-w-content mx-auto flex w-full flex-col gap-5 px-4 py-5 md:gap-7 md:px-8 md:py-7">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/" className="text-forest inline-flex min-h-11 items-center font-semibold">
          Início
        </Link>
        <Link
          href={`/campaigns/new/audience?campaign=${campaignId}`}
          className="text-forest inline-flex min-h-11 items-center font-semibold"
        >
          Voltar ao público ({audienceCount} clientes)
        </Link>
      </div>
      <p className="text-graphite text-sm">{storeName}</p>
      <h1 className="font-heading text-3xl font-semibold md:text-[38px]">
        Passo 2: Oferta e limites · {campaignName}
      </h1>

      <form action={action} className="grid items-start gap-6 md:grid-cols-[2fr_1fr]">
        <input type="hidden" name="campaignId" value={campaignId} />
        <input type="hidden" name="benefit" value={offer.benefit} />
        <input
          type="hidden"
          name="oncePerCustomer"
          value={offer.oncePerCustomer ? "true" : "false"}
        />
        <input
          type="hidden"
          name="newCustomersOnly"
          value={offer.newCustomersOnly ? "true" : "false"}
        />
        {offer.channels.map((channel) => (
          <input key={channel} type="hidden" name="channels" value={channel} />
        ))}

        <div className="bg-surface border-border rounded-card flex flex-col gap-6 border p-5 md:p-8">
          <fieldset className="flex flex-col gap-3.5">
            <legend className="font-heading mb-1 text-xl font-semibold">
              O que o cliente ganha
            </legend>
            <div role="group" aria-label="Tipo de benefício" className="flex flex-wrap gap-2.5">
              {BENEFITS.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  aria-pressed={offer.benefit === item.type}
                  onClick={() =>
                    update(
                      item.defaultAmount !== undefined
                        ? { benefit: item.type, amount: item.defaultAmount }
                        : { benefit: item.type, amount: null },
                    )
                  }
                  className="group bg-surface border-border text-ink aria-pressed:bg-forest aria-pressed:border-forest rounded-field flex min-h-[52px] flex-1 flex-col items-start gap-1 border-[1.5px] px-3 py-2 text-left text-[15px] font-semibold aria-pressed:text-white"
                >
                  {item.label}
                  <small className="text-graphite group-aria-pressed:text-sprout text-xs font-medium">
                    {item.hint}
                  </small>
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {offer.benefit !== "free_shipping" && (
                <label className="flex flex-col gap-2">
                  <span className="text-ink text-sm font-semibold">
                    {offer.benefit === "percentage"
                      ? "Percentual de desconto (%)"
                      : "Valor do desconto (R$)"}
                  </span>
                  <input
                    type="number"
                    name="amount"
                    min={1}
                    step="any"
                    value={offer.amount === null ? "" : String(offer.amount)}
                    onChange={(e) =>
                      update({
                        amount: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                      })
                    }
                    className={cn(inputClass, "tabular")}
                  />
                </label>
              )}
              <label className="flex flex-col gap-2">
                <span className="text-ink text-sm font-semibold">Pedido mínimo (R$)</span>
                <input
                  type="number"
                  name="minimumOrderValue"
                  min={0}
                  step="any"
                  value={offer.minimumOrderValue === null ? "" : String(offer.minimumOrderValue)}
                  onChange={(e) =>
                    update({
                      minimumOrderValue:
                        e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                    })
                  }
                  className={cn(inputClass, "tabular")}
                />
              </label>
            </div>
            {issues.has("invalid_amount") && (
              <p className="text-status-pending-ink text-sm">
                {OFFER_ISSUE_MESSAGE.invalid_amount}
              </p>
            )}
            {issues.has("minimum_above_average_order") && context.audienceAverageOrderValue > 0 && (
              <p className="text-status-pending-ink text-sm">
                Esse mínimo fica acima do pedido médio do público (
                {brl(context.audienceAverageOrderValue)}).
              </p>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-3.5">
            <legend className="font-heading mb-1 text-xl font-semibold">
              Por quanto tempo e quantas vezes
            </legend>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2">
                <span className="text-ink text-sm font-semibold">Começa em</span>
                <input
                  type="date"
                  name="startsOn"
                  value={offer.startsOn}
                  onChange={(e) => update({ startsOn: e.target.value })}
                  className={cn(inputClass, "tabular")}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-ink text-sm font-semibold">Termina em</span>
                <input
                  type="date"
                  name="endsOn"
                  value={offer.endsOn}
                  onChange={(e) => update({ endsOn: e.target.value })}
                  className={cn(inputClass, "tabular")}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-ink text-sm font-semibold">Limite de usos</span>
                <input
                  type="number"
                  name="usageLimit"
                  min={1}
                  value={offer.usageLimit === 0 ? "" : String(offer.usageLimit)}
                  onChange={(e) => update({ usageLimit: Number.parseInt(e.target.value, 10) || 0 })}
                  className={cn(inputClass, "tabular")}
                />
              </label>
            </div>
            {issues.has("invalid_period") && (
              <p className="text-status-pending-ink text-sm">
                {OFFER_ISSUE_MESSAGE.invalid_period}
              </p>
            )}
            {issues.has("invalid_usage_limit") && (
              <p className="text-status-pending-ink text-sm">
                {OFFER_ISSUE_MESSAGE.invalid_usage_limit}
              </p>
            )}

            <div className="border-border-soft flex items-center justify-between gap-3 border-t pt-3.5">
              <div className="flex flex-col">
                <span id="store-once-label" className="text-sm font-semibold">
                  Uma vez por cliente
                </span>
                <span className="text-graphite text-xs">
                  Evita que a mesma pessoa use o desconto em todos os pedidos.
                </span>
              </div>
              <Switch
                checked={offer.oncePerCustomer}
                onCheckedChange={(oncePerCustomer) => update({ oncePerCustomer })}
                aria-labelledby="store-once-label"
              />
            </div>

            <div className="border-border-soft flex items-center justify-between gap-3 border-t pt-3.5">
              <div className="flex flex-col">
                <span id="store-new-label" className="text-sm font-semibold">
                  Só para novos clientes
                </span>
                <span className="text-graphite text-xs">
                  Restringe o cupom a quem nunca comprou na loja.
                </span>
              </div>
              <Switch
                checked={offer.newCustomersOnly}
                onCheckedChange={(newCustomersOnly) => update({ newCustomersOnly })}
                aria-labelledby="store-new-label"
              />
            </div>
            {issues.has("new_customers_only_blocks_audience") && (
              <p role="alert" className="bg-peach text-peach-ink rounded-well px-4 py-3 text-sm">
                {OFFER_ISSUE_MESSAGE.new_customers_only_blocks_audience}
              </p>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-3.5">
            <legend className="font-heading mb-1 text-xl font-semibold">Onde e como usar</legend>
            <div className="flex flex-wrap gap-2.5">
              {CHANNELS.map((item) => (
                <label
                  key={item.channel}
                  className="border-border rounded-field flex min-h-11 cursor-pointer items-center gap-2.5 border-[1.5px] px-3.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={offer.channels.includes(item.channel)}
                    onChange={(e) => toggleChannel(item.channel, e.target.checked)}
                    className="accent-forest size-[18px]"
                  />
                  {item.label}
                </label>
              ))}
            </div>
            {issues.has("free_shipping_without_delivery") && (
              <p role="alert" className="bg-peach text-peach-ink rounded-well px-4 py-3 text-sm">
                {OFFER_ISSUE_MESSAGE.free_shipping_without_delivery}
              </p>
            )}
            <label className="flex max-w-sm flex-col gap-2">
              <span className="text-ink text-sm font-semibold">Código do cupom</span>
              <input
                type="text"
                name="couponCode"
                value={offer.couponCode ?? ""}
                onChange={(e) =>
                  update({ couponCode: e.target.value.toUpperCase().replace(/\s/g, "") })
                }
                autoComplete="off"
                className={cn(inputClass, "font-bold tracking-wider")}
              />
            </label>
            {issues.has("missing_coupon_code") && (
              <p role="alert" className="bg-peach text-peach-ink rounded-well px-4 py-3 text-sm">
                {OFFER_ISSUE_MESSAGE.missing_coupon_code}
              </p>
            )}
          </fieldset>
        </div>

        <aside className="bg-forest flex flex-col gap-5 rounded-[24px] p-6 text-white">
          <div className="flex flex-col gap-2">
            <h2 className="text-sprout text-sm font-semibold">Resumo e custo máximo</h2>
            <p className="font-heading tabular text-3xl font-semibold">
              {exposure.isExact ? "Até" : "Cerca de"} {brl(exposure.amount)}{" "}
              <span className="text-base font-medium text-white/80">em descontos</span>
            </p>
            <p className="text-xs text-white/80">
              Código: <strong>{normalizedCode ?? "Sem código"}</strong> · Validade:{" "}
              {weekdayDate(offer.startsOn)} a {weekdayDate(offer.endsOn)}
            </p>
          </div>

          {message && (
            <p role="alert" className="text-sprout text-sm font-semibold">
              {message}
            </p>
          )}

          <div className="flex flex-col gap-2.5">
            <Button
              type="submit"
              name="intent"
              value="proceed_to_review"
              fullWidth
              disabled={pending || !canProceed}
            >
              Revisar antes de criar
            </Button>
            <Button
              type="submit"
              name="intent"
              value="save_draft"
              variant="onDark"
              fullWidth
              disabled={pending}
            >
              Salvar rascunho
            </Button>
          </div>
        </aside>
      </form>
    </main>
  );
}
