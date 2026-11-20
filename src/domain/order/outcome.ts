/**
 * Normalized outcome of an order, stored in `orders.outcome`.
 *
 * Only `closed` counts as completed and `canceled` as canceled. Every other CW status is still
 * open: a delivered order can still be changed until it is closed.
 * This mapping is a working assumption; confirm it with the product owner before it shows in
 * the metrics (see docs/product/metrics.md).
 */
export type OrderOutcome = "completed" | "canceled" | "open";

export function outcomeFromStatus(status: string): OrderOutcome {
  if (status === "closed") return "completed";
  if (status === "canceled") return "canceled";
  return "open";
}
