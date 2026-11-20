# Volta: contexto e estado atual

Documento de passagem para quem entra no projeto. Descreve o que é o Volta e o que já existe no repositório, sem repetir a documentação completa, que está em `docs/`.

## O que é o Volta

App da CW App Store (Cardápio Web) para restaurantes. Ajuda o gestor a fazer campanhas de **recompra**:

1. Vê quais clientes frequentes pararam de pedir.
2. Monta uma oferta com custo máximo conhecido antes de criar qualquer coisa.
3. Revisa tudo.
4. Cria um cupom **inativo** na CW.
5. Acompanha o resultado separando o que foi **medido**, o que foi **observado** e o que **não foi medido**.

Contexto: Hackathon de Inovação Aberta FEJECE × Cardápio Web 2026, tema "Promoções e vendas", com "Relacionamento e recompra" como consequência. Pitch no IMPACTE'26 em 21/11.

## Regras que não podem ser quebradas

- Identificadores, rotas, tabelas, variáveis e commits em inglês. Textos que o gestor lê, em pt-BR, ficam em `src/copy` ou no JSX.
- `src/domain` é TypeScript puro, sem imports de Next, React, Supabase ou CW.
- Toda entrada externa (webhook, resposta da CW, formulário) é validada com Zod.
- Nada chega ao cliente final sem aprovação explícita. Cupom nasce inativo; ativação e envio de convites são ações separadas.
- Limites da CW: 5 requisições/min por loja no histórico de pedidos. Webhook de pedido responde 200 em até 5 s, então persiste primeiro e processa depois.
- Não adicionar checkout: a cobrança é feita pela CW.
- Nunca logar tokens, códigos, verificadores PKCE, tickets de SSO nem telefones de clientes.
- Só pnpm. Não commitar `package-lock.json` nem `yarn.lock`.
- Regras de negócio com teste `*.test.ts` ao lado do arquivo. Rodar `pnpm check` antes de terminar.

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui (Radix), `class-variance-authority`, Supabase (Postgres), Zod, Vitest, Playwright, ESLint, Prettier. Node 26, pnpm 12.

## Design: onde está

Templates em `design/templates/`:

- **Fonte editável:** `source/*.dc.html`, com `canvas-layout.json` e `canvas-map.json`.
- **Exportados:** `html/*.html`. Gerados por `pnpm templates:export`. Comece por `html/index.html`.

Telas em desktop (1440 px): `home`, `audience`, `offer`, `review`, `coupon-created`, `results`, `states`.

Telas em mobile (390 px): `mobile-home`, `mobile-audience`, `mobile-offer`, `mobile-review`, `mobile-coupon-created`, `mobile-results`. Não existe versão mobile de `states`.

Outros: `integration.html`, `design-system.html`, `reference.html`.

Material de apoio: `design/tokens.json`, `docs/design/design-system.md`, `design/reference/easymart.png`. Canvas no claude.ai (linkados no README): design e negócio/impacto.

Para abrir: `start C:\hackathon\volta\design\templates\html\index.html` no PowerShell.

Para implementar uma tela: skill `volta-screen-fidelity`.

## Código: o que existe

**Documentação:** `docs/` com produto, arquitetura, engenharia, modelo de dados, métricas, plano do hackathon, perguntas em aberto e 5 ADRs.

**Domínio** (`src/domain/`, com testes):

- `audience`: público explicável.
- `offer`: oferta com custo máximo.
- `campaign-status`: estados da campanha.
- `metrics/campaign-results`: resultados em três camadas.

**Integração CW** (`src/integrations/cardapio-web/`): OAuth com PKCE, cliente HTTP, mapeamento e criação de cupons, validação de webhooks, tipos gerados da OpenAPI.

**Aplicação e servidor:**

- `application/ports.ts` e o caso de uso `receive-order-event`.
- `server/`: validação de env, cliente Supabase com service role, criptografia de tokens em repouso, repositórios de `webhook_events` e `sync_jobs`.

**Rotas** (`src/app/api/`):

- Completas: OAuth (`start` e `callback`), SSO e a autenticação do cron.
- Parciais: webhooks de pedidos e de cobrança, que ainda precisam de verificação completa.
- Incompleta: `cron/sync` retorna `processedJobs: 0` e tem um TODO.

**Telas (`src/app/`):**

- `page.tsx` (home): ponto de partida com dados sintéticos. Faltam cabeçalho, gráfico de pontos e card de cobertura.
- `campaigns/new/audience`: placeholder.
- Demais telas: não existem como rotas.

**Banco** (`supabase/migrations/20261118000000_initial_schema.sql`): `stores`, `store_credentials`, `store_access`, `users`, `customers`, `orders`, `order_discounts`, `campaigns`, `campaign_audience`, `campaign_events`, `campaign_notes`, `webhook_events`, `sync_jobs`.

**Componentes:** `components/ui/button.tsx`, `components/ui/status-chip.tsx`. Tokens em `src/app/globals.css`. Textos em `src/copy/pt-BR.ts`. Dados sintéticos em `src/demo/`.

**Tooling:** `pnpm check` (lint, tipos, testes), CI no GitHub Actions, Playwright com um teste em `e2e/home.spec.ts`.

## Falta fazer

1. Telas: audience, offer, review, coupon-created, results, states, e completar a home.
2. Sincronização: consumir `sync_jobs` no cron e buscar pedidos na CW respeitando o limite de 5 req/min.
3. Repositórios de campanhas, clientes e pedidos.
4. Ligar a criação de cupom na CW a uma ação de tela, mantendo o cupom inativo.
5. Verificar os webhooks de pedidos e de cobrança.
6. Perguntas em aberto em `docs/open-questions.md`, em especial o modo de abertura do app (nova aba ou iframe) e a rotação do refresh token.
7. Retenção de dados após desinstalação (LGPD), a definir pelo squad.

## Como rodar

```bash
corepack enable pnpm
pnpm install
cp .env.example .env.local   # DEMO_MODE=true roda sem CW nem Supabase
pnpm dev                     # http://localhost:3000
pnpm check
```

Este arquivo não foi verificado rodando `pnpm check` nem o build. O estado descrito vem da leitura dos arquivos.
