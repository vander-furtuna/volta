"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FilterPill } from "@/components/ui/filter-pill";
import { CampaignStatusChip } from "@/components/ui/status-chip";
import type { DemoCampaign } from "@/demo/home-fixture";
import type { CampaignStatus } from "@/domain/campaign/campaign-status";

type Filter = "all" | "drafts" | "active" | "closed";

const FILTERS: { id: Filter; label: string; statuses: CampaignStatus[] | null }[] = [
  { id: "all", label: "Todas", statuses: null },
  {
    id: "drafts",
    label: "Rascunhos",
    statuses: ["draft", "audience_frozen", "creation_failed", "coupon_created"],
  },
  { id: "active", label: "Ativas", statuses: ["active", "invitations_sent"] },
  { id: "closed", label: "Encerradas", statuses: ["closed"] },
];

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** "Suas campanhas": filter pills, desktop card grid and mobile stacked list. */
export function CampaignList({ campaigns }: { campaigns: DemoCampaign[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const statuses = FILTERS.find((item) => item.id === filter)?.statuses ?? null;
  const visible = statuses
    ? campaigns.filter((campaign) => statuses.includes(campaign.status))
    : campaigns;

  return (
    <section aria-labelledby="campanhas" className="flex flex-col gap-3.5 md:gap-5">
      <div className="flex flex-col gap-3.5 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-4">
        <h2 id="campanhas" className="font-heading text-[22px] font-semibold md:text-[28px]">
          Suas campanhas
        </h2>
        <div
          role="group"
          aria-label="Filtrar campanhas"
          className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-0.5 md:mx-0 md:flex-wrap md:overflow-visible md:p-0"
        >
          {FILTERS.map((item) => (
            <FilterPill
              key={item.id}
              pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* Desktop: card grid */}
      <div className="hidden grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-5 md:grid">
        {visible.map((campaign) => (
          <article
            key={campaign.id}
            className="bg-surface border-border rounded-card flex flex-col border p-2.5"
          >
            <div className="bg-well rounded-well flex flex-col gap-1 px-5 py-[22px]">
              <span
                className={
                  campaign.offerHeadline.startsWith("R$")
                    ? "font-heading tabular text-forest text-4xl font-bold"
                    : "font-heading text-forest text-[30px] leading-[1.2] font-bold"
                }
              >
                {campaign.offerHeadline}
              </span>
              <span className="text-graphite text-sm">{campaign.offerDetail}</span>
            </div>
            <div className="flex flex-auto flex-col gap-2.5 px-2.5 pt-4 pb-2">
              <CampaignStatusChip status={campaign.status} className="self-start" />
              <h3 className="text-[17px] font-semibold">{campaign.name}</h3>
              <p className="text-graphite text-sm leading-normal">{campaign.summary}</p>
              {campaign.href && (
                <Button asChild variant="outline" className="mt-auto min-h-11">
                  <Link href={campaign.href}>{campaign.cta}</Link>
                </Button>
              )}
            </div>
          </article>
        ))}
        <Link
          href="/campaigns/new/audience"
          className="border-border-input text-ink rounded-card flex min-h-[300px] flex-col items-start justify-end gap-3 border-[1.5px] border-dashed p-7 no-underline"
        >
          <span className="bg-forest flex size-12 items-center justify-center rounded-full text-white">
            <PlusIcon className="size-[22px]" />
          </span>
          <span className="font-heading text-[22px] leading-[1.2] font-semibold">
            Nova campanha de recompra
          </span>
          <span className="text-graphite text-sm leading-normal">
            Público, oferta e revisão em três passos.
          </span>
        </Link>
      </div>

      {/* Mobile: stacked list */}
      <div className="flex flex-col gap-3.5 md:hidden">
        {visible.length > 0 && (
          <ul className="bg-surface border-border rounded-card flex flex-col border">
            {visible.map((campaign) => {
              const content = (
                <>
                  <span className="bg-well rounded-well flex size-[76px] flex-none flex-col items-center justify-center text-center">
                    <span
                      className={
                        campaign.offerHeadline.startsWith("R$")
                          ? "font-heading tabular text-forest text-xl font-bold"
                          : "font-heading text-forest text-[15px] leading-[1.1] font-bold"
                      }
                    >
                      {campaign.offerHeadline}
                    </span>
                    <span className="text-graphite text-[11px]">{campaign.offerDetailShort}</span>
                  </span>
                  <span className="flex min-w-0 flex-auto flex-col gap-1.5">
                    <b className="text-base">{campaign.name}</b>
                    <CampaignStatusChip status={campaign.status} className="self-start" />
                    <span className="text-graphite text-[13px]">{campaign.summaryShort}</span>
                  </span>
                </>
              );
              const rowClass = "text-ink flex items-center gap-3.5 p-3 no-underline";
              return (
                <li key={campaign.id} className="border-border-soft border-b last:border-b-0">
                  {campaign.href ? (
                    <Link href={campaign.href} className={rowClass}>
                      {content}
                    </Link>
                  ) : (
                    <div className={rowClass}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Button asChild variant="outline" fullWidth>
          <Link href="/campaigns/new/audience">
            <PlusIcon className="size-[18px]" />
            Nova campanha de recompra
          </Link>
        </Button>
      </div>
    </section>
  );
}
