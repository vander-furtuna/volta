import Link from "next/link";
import { CampaignCouponForm } from "@/components/campaign/campaign-coupon-form";
import { discountExposure, normalizeCouponCode } from "@/domain/offer/offer";
import type { StoredCampaign } from "@/server/database/campaign-repository";
import { brl, weekdayDate } from "./format";
import { benefitText, minimumSuffix } from "./offer-text";

export function StoreCampaignReview({
  campaign,
  storeName,
  audienceCount,
}: {
  campaign: StoredCampaign;
  storeName: string;
  audienceCount: number;
}) {
  const offer = campaign.offer;
  return (
    <main className="max-w-content mx-auto flex w-full flex-col gap-5 px-4 py-5 md:gap-7 md:px-8 md:py-7">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/"
          className="text-forest inline-flex min-h-11 items-center self-start font-semibold"
        >
          Início
        </Link>
        {!campaign.coupon_input && (
          <>
            <Link
              href={`/campaigns/new/audience?campaign=${campaign.id}`}
              className="text-forest inline-flex min-h-11 items-center font-semibold"
            >
              Alterar público
            </Link>
            <Link
              href={`/campaigns/new/offer?campaign=${campaign.id}`}
              className="text-forest inline-flex min-h-11 items-center font-semibold"
            >
              Alterar oferta
            </Link>
          </>
        )}
      </div>
      <h1 className="font-heading text-3xl font-semibold md:text-[38px]">{campaign.name}</h1>
      <p className="bg-mint text-mint-ink rounded-2xl px-4 py-3.5">
        O cupom será criado na loja <strong>{storeName}</strong>.
      </p>
      <div className="grid items-start gap-5 md:grid-cols-[2fr_1fr]">
        <section
          aria-labelledby="offer-review"
          className="bg-surface border-border rounded-card border p-5 md:p-9"
        >
          <h2 id="offer-review" className="font-heading mb-4 text-2xl font-semibold">
            Revisão da campanha
          </h2>
          {offer && (
            <dl className="divide-border-soft grid gap-2 divide-y">
              <div className="grid grid-cols-2 gap-3 py-2">
                <dt>Público</dt>
                <dd>{audienceCount} clientes</dd>
              </div>
              <div className="grid grid-cols-2 gap-3 py-2">
                <dt>Benefício</dt>
                <dd>
                  {benefitText(offer)}
                  {minimumSuffix(offer)}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-3 py-2">
                <dt>Validade</dt>
                <dd>
                  {weekdayDate(offer.startsOn)} a {weekdayDate(offer.endsOn)}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-3 py-2">
                <dt>Código</dt>
                <dd className="break-all">
                  {normalizeCouponCode(offer.couponCode) ?? "Sem código"}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-3 py-2">
                <dt>Limite</dt>
                <dd>
                  {offer.usageLimit} usos{offer.oncePerCustomer ? ", um por cliente" : ""}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-3 py-2">
                <dt>Descontos</dt>
                <dd>
                  {offer.benefit === "fixed_amount"
                    ? `Até ${brl(discountExposure(offer, { audienceAverageOrderValue: 0, averageDeliveryFee: 0 }).amount)}`
                    : "Aguardando estimativa da loja"}
                </dd>
              </div>
            </dl>
          )}
        </section>
        <section
          aria-labelledby="coupon-confirmation"
          className="bg-surface border-border rounded-card grid gap-4 border p-5 md:p-7"
        >
          <h2 id="coupon-confirmation" className="font-heading text-2xl font-semibold">
            Criar na Cardápio Web
          </h2>
          <p className="text-graphite">
            O cupom será criado desativado. Você decide quando ativar.
          </p>
          {offer && campaign.audience_frozen_at && audienceCount > 0 ? (
            <CampaignCouponForm
              campaignId={campaign.id}
              operation="create"
              frozenAt={campaign.audience_frozen_at}
              label={
                campaign.coupon_input
                  ? "Conferir criação na Cardápio Web"
                  : "Criar cupom na Cardápio Web"
              }
            />
          ) : (
            <p className="text-graphite">
              A campanha precisa de uma oferta e de um público congelado.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
