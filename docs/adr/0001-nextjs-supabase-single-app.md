# 0001. Um app Next.js com Supabase

- Status: Aceita
- Data: 17/11/2026

## Contexto

O hackathon termina em 20/11. O app precisa de interface, rotas de servidor para OAuth, SSO e webhooks, um banco e uma fila que respeite 5 consultas por minuto ao histórico de pedidos de cada loja.

## Decisão

Um único app Next.js (App Router, TypeScript) na Vercel. Supabase Postgres como banco; a fila é a tabela `sync_jobs`, processada por `/api/cron/sync` com `FOR UPDATE SKIP LOCKED`.

## Alternativas

- **Backend separado (NestJS/Fastify) + SPA:** mais peças para subir e manter no prazo.
- **Redis/BullMQ para a fila:** mais um serviço; o volume do hackathon cabe no Postgres.
- **pgmq:** boa opção para o futuro; a tabela simples é mais fácil de inspecionar durante a demo.

## Consequências

- Um deploy, um repositório, uma linguagem.
- Funções da Vercel têm tempo máximo de execução: o backfill é dividido em tarefas de uma página cada.
- Se o volume crescer, trocar a fila por pgmq ou um worker dedicado sem mudar o domínio.
