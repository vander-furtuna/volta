"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrderTagChip } from "./order-tag-chip";
import type { CouponOrderRow } from "./results-model";

/** Mobile stacked list of coupon orders; "Ver os N pedidos" expands to all of them. */
export function CouponOrdersList({
  preview,
  all,
  canceledCount,
}: {
  preview: CouponOrderRow[];
  all: CouponOrderRow[];
  canceledCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const orders = expanded ? all : preview;

  return (
    <>
      <p className="text-graphite -mt-2.5 text-[13px]" aria-live="polite">
        Mostrando {orders.length} de {all.length}, incluindo {canceledCount}{" "}
        {canceledCount === 1 ? "cancelado" : "cancelados"}
      </p>
      <ul id="m-pedidos-lista" className="bg-surface border-border rounded-card border px-4">
        {orders.map((order, index) => {
          const canceled = order.tag === "canceled";
          return (
            <li
              key={order.number}
              className={cn(
                "flex flex-col gap-1.5 py-3.5",
                index < orders.length - 1 && "border-border-soft border-b",
                canceled && "text-graphite",
              )}
            >
              <div className="flex justify-between gap-2">
                <b className={cn("text-[15px]", !order.customer && "text-graphite")}>
                  {order.customer ?? "Sem identificação"}
                </b>
                {canceled ? (
                  <s className="tabular text-[15px]">{order.total}</s>
                ) : (
                  <span className="tabular text-[15px] font-semibold">{order.total}</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={cn("tabular text-[13px]", !canceled && "text-graphite")}>
                  Nº {order.number}, {order.date}
                </span>
                <OrderTagChip order={order} compact />
              </div>
            </li>
          );
        })}
      </ul>
      <Button
        variant="outline"
        fullWidth
        aria-expanded={expanded}
        aria-controls="m-pedidos-lista"
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Mostrar menos" : `Ver os ${all.length} pedidos`}
      </Button>
    </>
  );
}
