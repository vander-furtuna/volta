---
name: campaign-metrics
description: Definitions and wording for every number Volta shows — audience counts, exclusions, offer cost ceiling, coupon usage, observed return, leakage and identification coverage. Use when computing, displaying, naming or testing any metric, chart or KPI, or when writing copy about results.
---

# Campaign metrics

Canonical definitions: `docs/product/metrics.md`. Reference code:
`src/domain/audience/audience.ts`, `src/domain/offer/offer.ts`, `src/domain/metrics/campaign-results.ts`.

## Three layers of results — never mix them

| Layer | What it means | Example label (pt-BR) |
| --- | --- | --- |
| Measured | Facts from orders linked by `coupon_id` | "Pedidos com o cupom", "Desconto concedido" |
| Observed | Invited customers who ordered again, with or without the coupon | "14 de 40 convidados voltaram a pedir" |
| Not measured | Causal effect; needs a holdout group | "Efeito da campanha: não medido" |

## Rules

- Only **completed** orders count. Canceled orders leave every sum and are reported separately.
- The denominator of "who came back" is the **frozen audience** (`campaign_audience`), never all customers.
- "Sem pedido identificado" is not "não voltou": orders without an identified customer are invisible.
- Discount cost counts only `sponsor = merchant`. iFood-sponsored discounts are not store cost.
- "Valor desses pedidos" is what customers paid after discounts. It is **not profit or revenue gained**.
- The offer ceiling is nominal discount only: exact for fixed amounts, an estimate for percentage and
  free shipping. It excludes messaging, food cost and other promotions.
- Show the time of the last update next to every number.
- Every new metric needs: definition, denominator, source table, time window and exclusions — add them
  to `docs/product/metrics.md` and a test next to the domain function.

## Forbidden wording

"Receita recuperada", "clientes perdidos", "ROI", "lucro", "campanha disparada", "entregue",
"orçamento garantido", "previsão de churn". Use the labels in `docs/product/metrics.md` instead.

## Charts

- Title states the finding ("Sexta e sábado concentraram metade dos usos"), not the chart type.
- Single series → no legend; two or more → legend plus direct labels.
- `chart-primary` and `chart-secondary` are close for protanopia: always pair with labels.
- Provide an `aria-label` that reads the data in words.
