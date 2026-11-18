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

export const DEMO_CAMPAIGNS: {
  id: string;
  name: string;
  status: CampaignStatus;
  summary: string;
}[] = [
  {
    id: "nov",
    name: "Volta de novembro",
    status: "draft",
    summary: "38 clientes no público. Criada hoje.",
  },
  { id: "out", name: "Volta de outubro", status: "closed", summary: "14 de 40 clientes voltaram." },
  {
    id: "feriado",
    name: "Retorno pós-feriado",
    status: "paused",
    summary: "Pausada com 6 de 30 usos.",
  },
];
