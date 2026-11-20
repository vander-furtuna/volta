import Link from "next/link";
import { CampaignStatusChip } from "@/components/ui/status-chip";
import { currency } from "@/copy/pt-BR";
import type { StoredCampaign } from "@/server/database/campaign-repository";
import type { readStoreCampaignResults } from "@/server/database/campaign-results-repository";

const date = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "medium",
});
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "medium",
  timeStyle: "short",
});
const PREVIEW_ORDERS = 10;

export function StoreCampaignResults({
  campaign,
  storeName,
  results,
}: {
  campaign: StoredCampaign;
  storeName: string;
  results: Awaited<ReturnType<typeof readStoreCampaignResults>>;
}) {
  const usage = results?.usage;
  const observed = results?.observedReturn;
  const returned = observed ? observed.returnedWithCoupon + observed.returnedWithoutCoupon : 0;
  return (
    <main className="max-w-content mx-auto grid w-full gap-5 px-4 pt-5 pb-16 md:gap-7 md:px-8 md:pt-7">
      <header className="grid gap-2">
        <Link
          href={`/campaigns/${campaign.id}`}
          className="text-forest inline-flex min-h-11 w-fit items-center font-semibold"
        >
          Voltar à campanha
        </Link>
        <p className="text-graphite text-sm">{storeName}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold md:text-[38px]">{campaign.name}</h1>
          <CampaignStatusChip status={campaign.status} />
        </div>
        {results && (
          <p className="text-graphite text-sm">
            Cupom válido de {date.format(results.startsAt)} a {date.format(results.expiresAt)}.{" "}
            Acompanhamento até {date.format(results.followUpEndsAt)}.
            {results.lastSyncAt && (
              <> Último pedido sincronizado em {dateTime.format(results.lastSyncAt)}.</>
            )}
          </p>
        )}
      </header>

      {!results || !usage || !results.lastSyncAt ? (
        <section className="bg-surface border-border rounded-card border p-5 md:p-8">
          <h2 className="font-heading text-xl font-semibold">
            {results ? "Aguardando sincronização" : "Resultados indisponíveis"}
          </h2>
          <p className="text-graphite mt-2">
            {results
              ? "Ainda não há pedidos sincronizados no período de acompanhamento."
              : "A campanha precisa de um cupom e de um período de acompanhamento válido."}
          </p>
        </section>
      ) : (
        <>
          <section
            className="bg-forest rounded-panel grid gap-3 p-5 text-white md:p-9"
            aria-labelledby="results-summary"
          >
            <h2 className="font-heading text-2xl font-semibold" id="results-summary">
              O que dá para afirmar
            </h2>
            <p>
              <strong>Medido.</strong>{" "}
              {usage.orders === 0
                ? "Nenhum uso registrado nos pedidos concluídos sincronizados."
                : `O cupom foi usado em ${usage.orders} ${usage.orders === 1 ? "pedido concluído sincronizado" : "pedidos concluídos sincronizados"}.`}
            </p>
            <p>
              <strong>Observado.</strong>{" "}
              {observed
                ? `${returned} de ${observed.invited} ${observed.invited === 1 ? "convidado" : "convidados"} ${returned === 1 ? "voltou" : "voltaram"} a pedir.`
                : "Aguardando a confirmação do envio dos convites."}
            </p>
            <p>
              <strong>Efeito da campanha não medido.</strong> Seria preciso acompanhar um grupo de
              comparação.
            </p>
          </section>

          <section
            className="bg-surface border-border rounded-card grid gap-4 border p-5 md:p-8"
            aria-labelledby="coupon-usage"
          >
            <h2 className="font-heading text-2xl font-semibold" id="coupon-usage">
              Uso do cupom
            </h2>
            <p className="text-graphite">
              Cupom {campaign.coupon_code} na Cardápio Web, nº {campaign.coupon_external_id}.{" "}
              Contagem baseada nos pedidos sincronizados no período.
            </p>
            <dl className="grid gap-4 md:grid-cols-3">
              <ResultStat label="Pedidos com o cupom" value={usage.orders} />
              <ResultStat
                label="Desconto concedido pela loja"
                value={currency.format(usage.merchantDiscount)}
              />
              <ResultStat label="Valor desses pedidos" value={currency.format(usage.orderValue)} />
            </dl>
            <p className="text-graphite text-sm">
              {usage.canceledOrdersExcluded}{" "}
              {usage.canceledOrdersExcluded === 1
                ? "pedido cancelado ficou fora das somas."
                : "pedidos cancelados ficaram fora das somas."}
            </p>
          </section>

          <section
            className="bg-surface border-border rounded-card grid gap-4 border p-5 md:p-8"
            aria-labelledby="observed-return"
          >
            <h2 className="font-heading text-2xl font-semibold" id="observed-return">
              Quem voltou
            </h2>
            {observed ? (
              <dl className="grid gap-4 md:grid-cols-3">
                <ResultStat label="Voltaram com cupom" value={observed.returnedWithCoupon} />
                <ResultStat label="Voltaram sem cupom" value={observed.returnedWithoutCoupon} />
                <ResultStat label="Sem pedido identificado" value={observed.noIdentifiedOrder} />
              </dl>
            ) : (
              <p className="text-graphite">
                Marque os convites como enviados para acompanhar quem voltou.
              </p>
            )}
            <p className="text-graphite text-sm">
              Entre os usos do cupom, {results.leakage.ordersFromNonInvited} vieram de clientes fora
              da lista e {results.leakage.ordersWithoutCustomer} ficaram sem cliente identificado.
            </p>
          </section>

          {results.couponOrders.length > 0 && (
            <section
              className="bg-surface border-border rounded-card grid gap-4 border p-5 md:p-8"
              aria-labelledby="coupon-orders"
            >
              <h2 className="font-heading text-2xl font-semibold" id="coupon-orders">
                Pedidos com o cupom
              </h2>
              <p className="text-graphite text-sm">
                Mostrando {Math.min(PREVIEW_ORDERS, results.couponOrders.length)} de{" "}
                {results.couponOrders.length}{" "}
                {results.couponOrders.length === 1 ? "pedido." : "pedidos."}
              </p>
              <ul className="divide-border-soft divide-y">
                {results.couponOrders.slice(0, PREVIEW_ORDERS).map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <span>
                      Nº {order.id} · {date.format(order.placedAt)}
                    </span>
                    <span className="tabular">
                      {order.outcome === "canceled" ? "Cancelado" : currency.format(order.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function ResultStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-well rounded-well grid gap-1 p-4">
      <dt className="text-graphite text-sm">{label}</dt>
      <dd className="font-heading tabular text-2xl font-semibold">{value}</dd>
    </div>
  );
}
