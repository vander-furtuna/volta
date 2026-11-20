import type { Offer } from "@/domain/offer/offer";
import { brl } from "./format";

/** Short benefit: "R$ 10", "15%", "Frete grátis". */
export function benefitShort(offer: Offer): string {
  const amount = offer.amount ?? 0;
  if (offer.benefit === "fixed_amount") return brl(amount);
  if (offer.benefit === "percentage") return `${amount}%`;
  return "Frete grátis";
}

/** Benefit sentence: "R$ 10 de desconto", "15% de desconto", "Frete grátis". */
export function benefitText(offer: Offer): string {
  return offer.benefit === "free_shipping" ? "Frete grátis" : `${benefitShort(offer)} de desconto`;
}

/** " em pedidos a partir de R$ 60", or "" without a minimum. */
export function minimumSuffix(offer: Offer): string {
  const minimum = offer.minimumOrderValue ?? 0;
  return minimum > 0 ? ` em pedidos a partir de ${brl(minimum)}` : "";
}

/** Step summary: "R$ 10 a partir de R$ 60". */
export function offerStepSummary(offer: Offer): string {
  const minimum = offer.minimumOrderValue ?? 0;
  return benefitShort(offer) + (minimum > 0 ? ` a partir de ${brl(minimum)}` : "");
}
