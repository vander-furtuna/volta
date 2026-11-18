import type { ExclusionReason } from "@/domain/audience/audience";
import type { CampaignStatus } from "@/domain/campaign/campaign-status";
import type { OfferIssueCode } from "@/domain/offer/offer";

/**
 * User-facing copy (pt-BR). Code identifiers stay in English; everything the restaurant
 * manager reads lives here. Voice and rules: docs/design/design-system.md#voz-e-escrita
 */

export const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Rascunho",
  audience_frozen: "Rascunho",
  creation_failed: "Rascunho, criação falhou",
  coupon_created: "Cupom criado, desativado",
  active: "Ativa, convite pendente",
  invitations_sent: "Ativa, convites enviados",
  paused: "Pausada por você",
  closed: "Encerrada",
};

export const EXCLUSION_LABEL: Record<ExclusionReason, string> = {
  whatsapp_not_allowed: "Não autorizaram mensagens no WhatsApp",
  missing_phone: "Sem telefone no cadastro",
  recently_invited: "Convidados pelo Volta há pouco tempo",
};

export const OFFER_ISSUE_MESSAGE: Record<OfferIssueCode, string> = {
  new_customers_only_blocks_audience:
    "Isso bloqueia todo o seu público. Os clientes da lista já compraram antes, então nenhum conseguiria usar o cupom.",
  missing_coupon_code:
    "Sem código, o cupom aparece para todos no cardápio. Escreva um código para manter o convite direcionado.",
  invalid_usage_limit: "Defina um limite de usos maior que zero.",
  invalid_amount: "O desconto precisa ser maior que zero. Percentuais vão até 100%.",
  free_shipping_without_delivery:
    "Frete grátis só vale para delivery. Marque Delivery ou escolha outro benefício.",
  invalid_period: "A data final precisa ser igual ou posterior à inicial.",
  minimum_above_average_order:
    "Esse mínimo fica acima do pedido médio do público. Menos clientes vão conseguir usar.",
  multiple_uses_per_customer: "Desligado, um mesmo cliente pode consumir vários usos do limite.",
};
