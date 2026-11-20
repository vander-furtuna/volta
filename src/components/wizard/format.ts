import { currency } from "@/copy/pt-BR";

/** "R$ 10" for whole amounts, "R$ 10,50" otherwise (same as the offer template). */
export function brl(amount: number): string {
  if (Number.isInteger(amount)) return `R$ ${amount.toLocaleString("pt-BR")}`;
  return currency.format(amount);
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** "terça, 18 de novembro" from "2026-11-18". Empty string for invalid input. */
export function weekdayDate(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return "";
  return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]}`;
}

/** "terça, 18" from "2026-11-18". */
export function weekdayDay(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return "";
  return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()}`;
}
