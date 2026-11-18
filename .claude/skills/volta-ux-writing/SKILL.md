---
name: volta-ux-writing
description: Voice, tone and microcopy rules for Volta's Brazilian Portuguese interface — buttons, errors, empty states, confirmations, status labels and numbers. Use whenever writing or reviewing any user-facing text in src/copy, JSX, emails or the pitch.
---

# Volta UX writing (pt-BR)

The reader is a busy restaurant owner or manager, on a phone between orders. Write so they can
decide in seconds and never feel misled about money or customers.

## Voice

- Plain Portuguese, sentence case, no data jargon ("público", not "segmento"; "voltou a pedir", not "reativado").
- Short sentences (aim for under 20 words). One idea per sentence.
- Honest about uncertainty: say what was measured, what was only observed and what was not measured.
- No exclamation marks, no emoji, no hype.

## Patterns

| Element | Pattern | Example |
| --- | --- | --- |
| Primary button | Verb + object, says exactly what happens | "Criar cupom na Cardápio Web" |
| Confirmation | Same verb, past tense, plus what comes next | "Cupom VOLTA10 criado, ainda desativado." |
| Error | What happened. Why, if known. What to do. No apology | "Não conseguimos criar o cupom. A Cardápio Web não respondeu a tempo. Seu rascunho está salvo." |
| Blocking warning | Consequence first, in bold, then the fix | "**Isso bloqueia todo o seu público.** … Desligue para seguir." |
| Empty state | Why it is empty + one action | "Ninguém entra com esse critério agora. … Mudar critério" |
| Numbers | Unit and period always; date of last update nearby | "R$ 140 em descontos, de até R$ 200" |
| Dates | Weekday and month spelled out, no ordinal | "domingo, 23 de novembro, às 23:59" |
| Status | Short noun phrase, matches the campaign state | "Ativa, convite pendente" |

## Words to use and to avoid

| Use | Avoid |
| --- | --- |
| Sem pedido identificado há 30 dias | Clientes perdidos / inativos |
| Convidados, público | Leads, segmento, base |
| Valor desses pedidos | Receita recuperada, faturamento gerado |
| Convites marcados como enviados | Campanha disparada, mensagens entregues |
| Até R$ 200 em descontos | Orçamento garantido, custo total |
| Efeito da campanha: não medido | ROI, impacto comprovado |

## Where text lives

- Reusable labels and messages: `src/copy/pt-BR.ts`, keyed by the domain's English codes.
- One-off screen copy: directly in the JSX, copied verbatim from the template in `design/templates`.
- Do not hard-code Portuguese inside `src/domain` or `src/integrations`.
