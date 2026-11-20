"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitCampaignAudience } from "@/app/campaigns/actions";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import {
  buildAudience,
  type AudienceCriteria,
  type ExclusionReason,
} from "@/domain/audience/audience";
import type { StoreCustomerSummary } from "@/domain/audience/store-audience";
import { daysBetween } from "@/domain/shared/time";

const EXCLUSION_LABEL: Record<ExclusionReason, string> = {
  whatsapp_not_allowed: "Fora: WhatsApp não autorizado",
  missing_phone: "Fora: sem telefone",
  recently_invited: "Fora: convidado recentemente",
};

export function StoreCampaignAudience({
  storeName,
  campaignId,
  initialName,
  criteria,
  customers,
  initialSelectedIds,
  nowIso,
}: {
  storeName: string;
  campaignId?: string;
  initialName: string;
  criteria: AudienceCriteria;
  customers: readonly StoreCustomerSummary[];
  initialSelectedIds?: readonly number[];
  nowIso: string;
}) {
  const now = new Date(nowIso);
  const audience = buildAudience(customers, criteria, now);
  const eligibleIds = audience.included.map((customer) => customer.id);

  const [name, setName] = useState(initialName);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => {
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      const allowed = new Set(eligibleIds);
      return new Set(initialSelectedIds.filter((id) => allowed.has(id)));
    }
    return new Set(eligibleIds);
  });
  const [message, action, pending] = useActionState(submitCampaignAudience, null);

  const exclusionById = new Map<number, ExclusionReason>(
    audience.excluded.map((entry) => [entry.customer.id, entry.reason]),
  );
  const opportunityCustomers = [
    ...audience.included,
    ...audience.excluded.map((entry) => entry.customer),
  ]
    .map((summary) => customers.find((c) => c.id === summary.id))
    .filter((c): c is StoreCustomerSummary => c !== undefined);

  const selectedCount = selectedIds.size;
  const uncheckedCount = eligibleIds.length - selectedCount;

  const toggle = (customerId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  };

  return (
    <main className="max-w-content mx-auto flex w-full flex-col gap-5 px-4 py-5 md:gap-7 md:px-8 md:py-7">
      <Link
        href="/"
        className="text-forest inline-flex min-h-11 items-center self-start font-semibold"
      >
        Início
      </Link>
      <p className="text-graphite text-sm">{storeName}</p>
      <h1 className="font-heading text-3xl font-semibold md:text-[38px]">
        Passo 1: Público da campanha
      </h1>

      <form action={action} className="flex flex-col gap-6">
        {campaignId && <input type="hidden" name="campaignId" value={campaignId} />}
        {Array.from(selectedIds).map((id) => (
          <input key={id} type="hidden" name="customerIds" value={String(id)} />
        ))}

        <section
          aria-labelledby="campaign-name-heading"
          className="bg-surface border-border rounded-card flex flex-col gap-3 border p-5 md:p-7"
        >
          <label className="flex flex-col gap-2">
            <span id="campaign-name-heading" className="text-ink text-sm font-semibold">
              Nome da campanha
            </span>
            <input
              type="text"
              name="name"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="bg-surface border-border-input text-ink rounded-field h-12 max-w-md border-[1.5px] px-3.5 text-base font-medium"
            />
          </label>
          <p className="text-graphite text-sm">
            Critério: clientes com pelo menos {criteria.minCompletedOrders} pedidos concluídos nos
            últimos 6 meses e sem pedido há mais de {criteria.minDaysSinceLastOrder} dias.
          </p>
        </section>

        <div className="grid items-start gap-5 md:grid-cols-[1fr_2fr]">
          <section
            aria-labelledby="audience-breakdown"
            className="bg-surface border-border rounded-card flex flex-col gap-3 border p-5 md:p-7"
          >
            <h2 id="audience-breakdown" className="font-heading text-xl font-semibold">
              Como chegamos a {selectedCount} clientes
            </h2>
            <dl className="divide-border-soft flex flex-col divide-y text-sm">
              <div className="flex justify-between py-2.5">
                <dt>Com {criteria.minCompletedOrders} ou mais pedidos</dt>
                <dd className="tabular font-semibold">{audience.frequentCustomers}</dd>
              </div>
              <div className="text-graphite flex justify-between py-2.5">
                <dt>Pediram nos últimos {criteria.minDaysSinceLastOrder} dias</dt>
                <dd className="tabular">−{audience.orderedRecently}</dd>
              </div>
              <div className="flex justify-between py-2.5 font-semibold">
                <dt>Na oportunidade</dt>
                <dd className="tabular">{audience.opportunity}</dd>
              </div>
              {audience.exclusions.map(({ reason, count }) => (
                <div key={reason} className="text-graphite flex justify-between py-2.5">
                  <dt>{EXCLUSION_LABEL[reason]}</dt>
                  <dd className="tabular">−{count}</dd>
                </div>
              ))}
              {uncheckedCount > 0 && (
                <div className="text-graphite flex justify-between py-2.5">
                  <dt>Desmarcados por você</dt>
                  <dd className="tabular">−{uncheckedCount}</dd>
                </div>
              )}
            </dl>
            <div className="bg-forest mt-2 flex items-center justify-between rounded-2xl px-4 py-3.5 text-white">
              <span className="font-semibold">No público desta campanha</span>
              <span className="font-heading tabular text-sprout text-2xl font-bold">
                {selectedCount}
              </span>
            </div>
          </section>

          <section
            aria-labelledby="audience-customers"
            className="bg-surface border-border rounded-card flex flex-col gap-4 border p-5 md:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="audience-customers" className="font-heading text-xl font-semibold">
                Clientes na oportunidade ({opportunityCustomers.length})
              </h2>
              {eligibleIds.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="compact"
                    disabled={selectedCount === eligibleIds.length}
                    onClick={() => setSelectedIds(new Set(eligibleIds))}
                  >
                    Selecionar todos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="compact"
                    disabled={selectedCount === 0}
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Desmarcar todos
                  </Button>
                </div>
              )}
            </div>

            {opportunityCustomers.length === 0 ? (
              <p className="text-graphite text-sm">
                Nenhum cliente frequente encontrado com esse critério nos pedidos sincronizados até
                agora.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabular w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-graphite border-border border-b text-left">
                      <th scope="col" className="w-11 py-2">
                        <span className="sr-only">Incluir</span>
                      </th>
                      <th scope="col" className="py-2 pr-3">
                        Cliente
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        Pedidos
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        Último pedido
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        Intervalo típico
                      </th>
                      <th scope="col" className="py-2 pl-3">
                        Situação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border-soft divide-y">
                    {opportunityCustomers.map((customer) => {
                      const reason = exclusionById.get(customer.id) ?? null;
                      const selectable = reason === null;
                      const checked = selectable && selectedIds.has(customer.id);
                      return (
                        <tr key={customer.id}>
                          <td className="py-2">
                            {selectable && (
                              <label className="flex size-11 cursor-pointer items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggle(customer.id)}
                                  className="accent-forest size-[18px]"
                                />
                                <span className="sr-only">Incluir {customer.name} no público</span>
                              </label>
                            )}
                          </td>
                          <td className="py-3 pr-3 font-semibold">{customer.name}</td>
                          <td className="px-3 py-3 text-right">{customer.completedOrders}</td>
                          <td className="px-3 py-3 text-right">
                            há {daysBetween(customer.lastOrderAt, now)} dias
                          </td>
                          <td className="px-3 py-3 text-right">
                            {customer.typicalIntervalDays !== null
                              ? `${customer.typicalIntervalDays} dias`
                              : "—"}
                          </td>
                          <td className="py-3 pl-3">
                            {checked ? (
                              <StatusChip tone="active" label="No público" />
                            ) : (
                              <StatusChip
                                tone="draft"
                                label={
                                  reason ? EXCLUSION_LABEL[reason] : "Fora: desmarcado por você"
                                }
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="bg-surface border-border rounded-card flex flex-col gap-3 border p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-ink text-sm">
              {selectedCount === 0
                ? "Selecione ao menos um cliente para congelar o público e continuar."
                : `Ao continuar, a lista de ${selectedCount} clientes fica congelada para medir quem voltou.`}
            </p>
            {message && (
              <p role="alert" className="text-ember text-sm font-semibold">
                {message}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              name="intent"
              value="save_draft"
              variant="outline"
              disabled={pending}
            >
              Salvar rascunho
            </Button>
            <Button
              type="submit"
              name="intent"
              value="freeze_audience"
              disabled={pending || selectedCount === 0}
            >
              Congelar público e continuar
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}
