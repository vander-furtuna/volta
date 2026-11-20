import type { CampaignStatus } from "@/domain/campaign/campaign-status";

/**
 * Synthetic data used in demo mode (DEMO_MODE=true). Always labeled "Dados de demonstração"
 * in the UI. Numbers match the design templates so screens can be compared side by side.
 */
export const DEMO_STORE = {
  name: "Hamburgueria Dois Irmãos",
  unit: "Aldeota",
} as const;

export const DEMO_OPPORTUNITY = {
  frequentCustomersWithoutOrder: 52,
  minCompletedOrders: 3,
  minDaysSinceLastOrder: 30,
  identifiedOrderShare: 0.71,
  historyStartLabel: "18 de maio",
  updatedAtLabel: "19:24",
} as const;

export const DEMO_IDENTIFIED_BY_CHANNEL: { channel: string; share: number }[] = [
  { channel: "Cardápio digital", share: 0.92 },
  { channel: "iFood", share: 0.64 },
  { channel: "Balcão e WhatsApp", share: 0.18 },
];

/** Below this share of identified orders a channel is highlighted as a measurement gap. */
export const LOW_IDENTIFICATION_SHARE = 0.5;

export interface DemoCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  /** Offer headline in the card ("R$ 10", "Frete grátis") */
  offerHeadline: string;
  offerDetail: string;
  offerDetailShort: string;
  summary: string;
  summaryShort: string;
  href: string | null;
  cta: string;
}

export const DEMO_CAMPAIGNS: DemoCampaign[] = [
  {
    id: "nov",
    name: "Volta de novembro",
    status: "draft",
    offerHeadline: "R$ 10",
    offerDetail: "em pedidos a partir de R$ 60",
    offerDetailShort: "a partir de 60",
    summary: "38 clientes no público. Criada hoje.",
    summaryShort: "38 clientes no público",
    href: "/campaigns/new/offer",
    cta: "Continuar",
  },
  {
    id: "out",
    name: "Volta de outubro",
    status: "closed",
    offerHeadline: "R$ 10",
    offerDetail: "em pedidos a partir de R$ 60",
    offerDetailShort: "a partir de 60",
    summary: "14 de 40 clientes voltaram. Cupom usado 14 vezes.",
    summaryShort: "14 de 40 clientes voltaram",
    href: "/campaigns/out/results",
    cta: "Ver resultado",
  },
  {
    id: "feriado",
    name: "Retorno pós-feriado",
    status: "paused",
    offerHeadline: "Frete grátis",
    offerDetail: "em pedidos a partir de R$ 50",
    offerDetailShort: "a partir de 50",
    summary: "Pausada em 14 de outubro, com 6 de 30 usos.",
    summaryShort: "6 de 30 usos",
    // No demo screen for this campaign yet: the card renders without a link.
    href: null,
    cta: "Ver campanha",
  },
];
