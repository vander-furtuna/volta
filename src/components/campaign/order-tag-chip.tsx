import { StatusChip } from "@/components/ui/status-chip";
import type { CouponOrderRow } from "./results-model";

/** "Na conta como" chip of a coupon order. Compact labels are the mobile template's. */
export function OrderTagChip({ order, compact }: { order: CouponOrderRow; compact?: boolean }) {
  if (order.tag === "invited") {
    const label = order.feminine ? "Convidada" : "Convidado";
    return <StatusChip tone="active" label={compact ? label : `${label} que voltou`} />;
  }
  if (order.tag === "outside") {
    return <StatusChip tone="pending" label={compact ? "Fora da lista" : "Uso fora da lista"} />;
  }
  return <StatusChip tone="draft" label={compact ? "Cancelado" : "Cancelado, fora da conta"} />;
}
