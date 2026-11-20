"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { OFFER_ISSUE_MESSAGE } from "@/copy/pt-BR";
import { createDemoCoupon, useCampaignDraft, useDraftAudience } from "@/demo/campaign-draft";
import { DEFAULT_CRITERIA, DEMO_CAMPAIGN, DEMO_OFFER_CONTEXT } from "@/demo/wizard-fixture";
import {
  canProceedToReview,
  discountExposure,
  normalizeCouponCode,
  type OrderChannel,
} from "@/domain/offer/offer";
import { toCwCouponInput } from "@/integrations/cardapio-web/coupon-mapper";
import { brl, weekdayDate, weekdayDay } from "./format";
import { benefitShort, benefitText, minimumSuffix } from "./offer-text";

/**
 * Review step body. Renders exactly what the manager chose: the offer and the selected customers
 * come from the campaign draft. Confirming creates the (simulated) inactive coupon.
 * Reference: review.dc.html and mobile-review.dc.html.
 */

const AUDIENCE_HREF = "/campaigns/new/audience";
const OFFER_HREF = "/campaigns/new/offer";

const CHANNEL_NAME: Record<OrderChannel, string> = {
  delivery: "delivery",
  takeout: "retirada",
  dine_in: "consumo no local",
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

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
      className={className}
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 3l9.5 17H2.5z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  );
}

function SummaryRow({
  label,
  desktop,
  mobile,
  href,
  editLabel,
  last = false,
  valueClassName,
}: {
  label: string;
  desktop: ReactNode;
  mobile?: ReactNode;
  href?: string;
  editLabel?: string;
  last?: boolean;
  valueClassName?: string;
}) {
  return (
    <div
      className={
        "border-border-soft flex items-start justify-between gap-3 border-t py-3.5 md:grid md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-baseline md:gap-4 md:py-4" +
        (last ? " pb-0 md:border-b md:pb-4" : "")
      }
    >
      <div className="flex flex-col gap-[3px] md:contents">
        <dt className="text-graphite text-[13px] md:text-[15px]">{label}</dt>
        <dd className={valueClassName}>
          {mobile ? (
            <>
              <span className="hidden md:inline">{desktop}</span>
              <span className="md:hidden">{mobile}</span>
            </>
          ) : (
            desktop
          )}
        </dd>
      </div>
      {href ? (
        <dd className="flex-none">
          <Link
            href={href}
            aria-label={editLabel}
            className="text-forest hover:text-forest-deep flex min-h-11 items-center text-sm font-semibold md:min-h-0"
          >
            Alterar
          </Link>
        </dd>
      ) : (
        <span className="hidden md:block" />
      )}
    </div>
  );
}

export function ReviewSummary() {
  const router = useRouter();
  const { offer } = useCampaignDraft();
  const { selectedCount } = useDraftAudience();

  const context = DEMO_OFFER_CONTEXT;
  const exposure = discountExposure(offer, context);
  const offerReady = canProceedToReview(offer, context);
  const canCreate = offerReady && selectedCount > 0;
  const code = normalizeCouponCode(offer.couponCode);
  const frozenAt = DEMO_CAMPAIGN.audienceSavedAt;
  const people = `${selectedCount} ${selectedCount === 1 ? "cliente" : "clientes"}`;
  const benefit = benefitText(offer);
  const benefitLower = offer.benefit === "free_shipping" ? "frete grátis" : benefit;
  const minimum = minimumSuffix(offer);
  const channels = offer.channels.length
    ? capitalize(joinPt(offer.channels.map((channel) => CHANNEL_NAME[channel])))
    : "Nenhum canal marcado";
  const perCustomer = offer.oncePerCustomer ? "1 por cliente" : "sem limite por cliente";
  const year = offer.endsOn.slice(0, 4);
  const ceiling = `${exposure.isExact ? "Até" : "Cerca de"} ${brl(exposure.amount)} em descontos`;
  const ceilingBasis = `(${exposure.isExact ? "" : "estimativa: "}${brl(exposure.basis.perUse)} × ${exposure.basis.uses} usos)`;
  const sentence = `Convidar ${people} frequentes que não pedem há mais de ${DEFAULT_CRITERIA.minDaysSinceLastOrder} dias a voltar, com ${benefitLower}${minimum}.`;

  const payload = toCwCouponInput(offer, DEMO_CAMPAIGN.name);
  const payloadLines = Object.entries(payload).map(
    ([key, value]) =>
      `${key}: ${Array.isArray(value) ? `[${value.join(", ")}]` : JSON.stringify(value)}`,
  );

  const checks: { ok: boolean; desktop: string; mobile: string }[] = [
    code
      ? {
          ok: true,
          desktop: "O cupom exige código, então não aparece aberto no cardápio.",
          mobile: "Exige código, então não aparece aberto no cardápio.",
        }
      : {
          ok: false,
          desktop: OFFER_ISSUE_MESSAGE.missing_coupon_code,
          mobile: OFFER_ISSUE_MESSAGE.missing_coupon_code,
        },
    offer.newCustomersOnly
      ? {
          ok: false,
          desktop: OFFER_ISSUE_MESSAGE.new_customers_only_blocks_audience,
          mobile: OFFER_ISSUE_MESSAGE.new_customers_only_blocks_audience,
        }
      : {
          ok: true,
          desktop:
            "A regra de novos clientes está desligada, combinando com o objetivo de recompra.",
          mobile: "Regra de novos clientes desligada.",
        },
    {
      ok: true,
      desktop: "As datas não se sobrepõem a outra campanha do Volta.",
      mobile: "Sem sobreposição com outra campanha do Volta.",
    },
    ...(offer.oncePerCustomer
      ? []
      : [
          {
            ok: false,
            desktop: OFFER_ISSUE_MESSAGE.multiple_uses_per_customer,
            mobile: OFFER_ISSUE_MESSAGE.multiple_uses_per_customer,
          },
        ]),
    {
      ok: false,
      desktop: `Quem receber o código de um convidado também consegue usar. O limite de ${offer.usageLimit} usos segura o custo.`,
      mobile: `Quem receber o código de um convidado também consegue usar. O limite de ${offer.usageLimit} usos segura o custo.`,
    },
  ];

  const confirm = () => {
    createDemoCoupon();
    router.push("/campaigns/nov");
  };

  return (
    <div className="flex flex-col flex-wrap gap-5 md:flex-row md:items-start md:gap-6">
      {/* Summary */}
      <section
        aria-labelledby="resumo"
        className="bg-surface border-border rounded-card flex w-full min-w-0 flex-col gap-[18px] border p-5 md:flex-[999_1_600px] md:gap-7 md:p-9"
      >
        <div className="flex flex-col gap-2.5 md:gap-3">
          <h2 id="resumo" className="text-graphite text-sm font-semibold md:text-[15px]">
            Em uma frase
          </h2>
          <p className="font-heading max-w-[30ch] text-[23px] leading-[1.25] font-medium text-pretty md:text-3xl md:leading-[1.22]">
            {sentence}
          </p>
        </div>
        <dl className="flex flex-col text-[15px]">
          <SummaryRow
            label="Público"
            desktop={`${people}, lista congelada hoje às ${frozenAt}`}
            mobile={`${people}, congelado às ${frozenAt}`}
            href={AUDIENCE_HREF}
            editLabel="Alterar público"
          />
          <SummaryRow
            label="Benefício"
            desktop={`${benefit}${minimum}`}
            mobile={`${benefitShort(offer)}${minimum}`}
            href={OFFER_HREF}
            editLabel="Alterar benefício"
          />
          <SummaryRow
            label="Validade"
            desktop={`De ${weekdayDate(offer.startsOn)}, às 00:00, até ${weekdayDate(offer.endsOn)} de ${year}, às 23:59`}
            mobile={`De ${weekdayDay(offer.startsOn)}, às 00:00, até ${weekdayDate(offer.endsOn)}, às 23:59`}
            href={OFFER_HREF}
            editLabel="Alterar validade"
          />
          <div className="contents md:hidden">
            <SummaryRow
              label="Limites e onde vale"
              desktop={`${offer.usageLimit} usos, ${perCustomer}. ${channels}.`}
              href={OFFER_HREF}
              editLabel="Alterar limites e onde vale"
            />
          </div>
          <div className="hidden md:contents">
            <SummaryRow
              label="Limites"
              desktop={`${offer.usageLimit} usos no total e ${perCustomer}`}
              href={OFFER_HREF}
              editLabel="Alterar limites"
            />
            <SummaryRow
              label="Onde vale"
              desktop={`${channels}, todos os dias e horários`}
              href={OFFER_HREF}
              editLabel="Alterar onde vale"
            />
          </div>
          <SummaryRow
            label="Código"
            desktop={code ?? "Sem código"}
            href={OFFER_HREF}
            editLabel="Alterar código"
            valueClassName="font-heading text-forest text-lg font-bold tracking-[.06em]"
          />
          <SummaryRow
            label="Custo máximo"
            desktop={
              <>
                <b>{ceiling}</b> {ceilingBasis}
              </>
            }
            last
          />
        </dl>
        <details className="bg-paper rounded-well px-4 py-0.5 md:rounded-2xl md:px-5 md:py-1">
          <summary className="text-forest flex min-h-12 cursor-pointer items-center text-sm font-semibold md:text-[15px]">
            Ver o que será enviado à Cardápio Web
          </summary>
          <pre className="text-ink mb-3.5 font-mono text-xs leading-[1.7] whitespace-pre-wrap md:mb-[18px] md:text-[13px]">
            {["POST /api/partner/v1/merchant/coupons", ...payloadLines].join("\n")}
          </pre>
        </details>
      </section>

      {/* `contents` on mobile so the action panel can stick to the bottom of the whole step */}
      <aside className="contents md:flex md:w-full md:min-w-0 md:flex-[1_1_360px] md:flex-col md:gap-6">
        <section
          aria-labelledby="conferido"
          className="bg-surface border-border rounded-card flex flex-col gap-3 border p-5 md:gap-4 md:p-7"
        >
          <h2 id="conferido" className="font-heading text-xl font-semibold md:text-[22px]">
            O que já conferimos
          </h2>
          <ul className="flex flex-col gap-3 text-sm leading-[1.45] md:gap-3.5 md:text-[15px]">
            {checks.map((check) => (
              <li key={check.desktop} className="flex gap-2.5 md:gap-3">
                {check.ok ? (
                  <CheckIcon className="text-status-active-ink mt-px size-[18px] flex-none md:size-5" />
                ) : (
                  <WarningIcon className="text-status-pending-ink mt-px size-[18px] flex-none md:size-5" />
                )}
                <span>
                  <span className="hidden md:inline">{check.desktop}</span>
                  <span className="md:hidden">{check.mobile}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Nothing reaches the customer yet: desktop card, sticky bottom panel on mobile */}
        <section
          aria-labelledby="botoes"
          className="bg-forest sticky bottom-0 z-10 -mx-4 flex flex-col gap-2.5 rounded-t-[24px] px-4 pt-[18px] pb-6 text-white md:static md:mx-0 md:gap-[18px] md:rounded-[24px] md:p-7"
        >
          <h2 id="botoes" className="font-heading hidden text-[22px] font-semibold md:block">
            Nada chega ao cliente ainda
          </h2>
          <p className="text-sm leading-normal text-white/85 md:text-[15px] md:leading-[1.55]">
            <span className="hidden md:inline">
              O cupom é criado desativado na Cardápio Web. Você confere, ativa e só então convida os
              clientes, no próximo passo.
            </span>
            <span className="md:hidden">
              <b className="text-white">Nada chega ao cliente ainda.</b> O cupom é criado
              desativado. Você ativa e convida no próximo passo.
            </span>
          </p>
          {!canCreate && (
            <p role="alert" className="text-sprout text-sm leading-normal font-semibold">
              {selectedCount === 0 ? (
                <Link href={AUDIENCE_HREF} className="text-sprout underline">
                  Selecione ao menos um cliente no público.
                </Link>
              ) : (
                <Link href={OFFER_HREF} className="text-sprout underline">
                  Resolva os avisos da oferta para criar o cupom.
                </Link>
              )}
            </p>
          )}
          <Button fullWidth disabled={!canCreate} onClick={confirm}>
            Criar cupom na Cardápio Web
          </Button>
          <Button variant="onDark" fullWidth>
            Salvar rascunho
          </Button>
        </section>
      </aside>
    </div>
  );
}
