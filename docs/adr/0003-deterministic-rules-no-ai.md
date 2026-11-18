# 0003. Regras determinísticas, sem IA

- Status: Aceita
- Data: 17/11/2026

## Contexto

O valor do Volta está em explicar o público, limitar o custo e ler o resultado com honestidade. A banca avalia aderência, protótipo funcionando e modelo de negócio.

## Decisão

Público, avisos de oferta, custo máximo e métricas são regras determinísticas em `src/domain`, testadas e explicáveis na tela. Nenhuma chamada a modelos de linguagem no fluxo principal.

## Alternativas

- **Sugerir oferta com IA:** difícil de testar e de explicar à banca; arrisca prometer resultado sem dados.
- **Previsão de churn:** exige histórico e avaliação que não temos no prazo.

## Consequências

- Cada número da interface tem uma definição em `docs/product/metrics.md`.
- IA pode entrar depois em tarefas de texto (rascunho da mensagem), sempre com revisão do gestor.
