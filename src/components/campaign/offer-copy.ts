import { currency } from "@/copy/pt-BR";
import type { Offer, OrderChannel } from "@/domain/offer/offer";

/** pt-BR wording of the configured offer, for the coupon-created screen and invite message. */

const CHANNEL_LABEL: Record<OrderChannel, string> = {
  delivery: "delivery",
  takeout: "retirada",
  dine_in: "consumo no local",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Observed return is followed for 7 days after the coupon ends (docs/product/metrics.md). */
const FOLLOW_UP_DAYS = 7;

/** "R$ 10" for whole amounts, "R$ 10,50" otherwise. */
export function money(value: number) {
  return currency.format(value).replace(/,00$/, "");
}

function isoToDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`);
}

function formatDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...options }).format(date);
}

/** "domingo, 23 de novembro" / "segunda, 23 de novembro" (spoken form, without "-feira") */
export function weekdayDate(iso: string) {
  return formatDate(isoToDate(iso), { weekday: "long", day: "numeric", month: "long" }).replace(
    "-feira",
    "",
  );
}

/** "30 de novembro" */
export function dayMonth(date: Date) {
  return formatDate(date, { day: "numeric", month: "long" });
}

export function followUpEnd(offer: Offer) {
  return new Date(isoToDate(offer.endsOn).getTime() + FOLLOW_UP_DAYS * MS_PER_DAY);
}

/** "De 18 a 30 de novembro" or "De 28 de outubro a 4 de novembro" */
export function trackingWindow(offer: Offer) {
  const start = isoToDate(offer.startsOn);
  const end = followUpEnd(offer);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const from = sameMonth ? String(start.getUTCDate()) : dayMonth(start);
  return `De ${from} a ${dayMonth(end)}`;
}

/** "R$ 10 de desconto", "15% de desconto" or "frete grátis" */
export function benefitText(offer: Offer) {
  const amount = offer.amount ?? 0;
  if (offer.benefit === "fixed_amount") return `${money(amount)} de desconto`;
  if (offer.benefit === "percentage") return `${amount}% de desconto`;
  return "frete grátis";
}

function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

/** "R$ 10 de desconto a partir de R$ 60, em delivery e retirada, até 20 usos, um por cliente." */
export function offerSummary(offer: Offer) {
  const parts = [benefitText(offer)];
  if (offer.minimumOrderValue) parts[0] += ` a partir de ${money(offer.minimumOrderValue)}`;
  if (offer.channels.length > 0) {
    parts.push(`em ${joinList(offer.channels.map((c) => CHANNEL_LABEL[c]))}`);
  }
  parts.push(`até ${offer.usageLimit} ${offer.usageLimit === 1 ? "uso" : "usos"}`);
  if (offer.oncePerCustomer) parts.push("um por cliente");
  const text = parts.join(", ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/** Suggested invite message, same wording as the template, filled with the offer. */
export function inviteMessage(offer: Offer, code: string, storeName: string) {
  const minimum = offer.minimumOrderValue ? ` a partir de ${money(offer.minimumOrderValue)}` : "";
  return `Oi, [primeiro nome]! Faz um tempinho que você não pede na ${storeName}. Separamos ${benefitText(offer)} para seu próximo pedido${minimum}. É só usar o código ${code} até ${weekdayDate(offer.endsOn)}: [link do cardápio]`;
}
