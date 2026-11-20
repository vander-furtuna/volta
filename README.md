# Volta

Campanhas de recompra compreensíveis, controladas e mensuráveis para restaurantes da [Cardápio Web](https://www.cardapioweb.com), distribuídas pela CW App Store.

O gestor vê quais clientes frequentes pararam de pedir, monta uma oferta com custo máximo conhecido, revisa tudo antes de criar o cupom na CW e acompanha o resultado separando o que foi medido do que foi só observado.

> Projeto do Hackathon de Inovação Aberta FEJECE × Cardápio Web 2026, tema **Promoções e vendas**, com **Relacionamento e recompra** como consequência.

## Links

| O quê                           | Onde                                                                   |
| ------------------------------- | ---------------------------------------------------------------------- |
| Canvas de design (fonte visual) | https://claude.ai/artifact/PT96JSG5kdBuN3FdHyexMV                      |
| Canvas de negócio e impacto     | https://claude.ai/artifact/R16xt2x7JBqZpi4oAomaY8                      |
| Templates de tela exportados    | [`design/templates/html/index.html`](design/templates/html/index.html) |
| Documentação técnica            | [`docs/`](docs/README.md)                                              |
| Documentação da API da CW       | https://docs.cardapioweb.com                                           |

## Stack

- **Next.js 16** (App Router, TypeScript estrito) com rotas de servidor para OAuth, SSO e webhooks
- **Tailwind CSS 4** com tokens do design em `src/app/globals.css`
- **shadcn/ui** (Radix), `class-variance-authority` para variantes e `cn` para compor classes
- **Supabase** (Postgres) como banco e fila de sincronização
- **Zod** para validar entradas externas
- **Vitest** (unidade) e **Playwright** (ponta a ponta)

Decisões e alternativas em [`docs/adr/`](docs/adr).

## Como rodar

Pré-requisitos: Node 26 (veja `.nvmrc`) e **pnpm 12**. A versão exata está fixada em `packageManager` no `package.json`; qualquer pnpm recente troca sozinho para ela.

```bash
corepack enable pnpm         # ou: npm install -g pnpm@12
pnpm install
cp .env.example .env.local   # DEMO_MODE=true já funciona sem CW nem Supabase
pnpm dev                     # http://localhost:3000
```

Para integrar com a CW de verdade, siga [`docs/architecture/cardapio-web-integration.md`](docs/architecture/cardapio-web-integration.md).

## Scripts

| Comando                         | O que faz                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm dev`                      | Servidor de desenvolvimento                                                                |
| `pnpm build` / `pnpm start`     | Build e servidor de produção                                                               |
| `pnpm check`                    | Lint, tipos e testes de unidade (o mesmo que a CI roda)                                    |
| `pnpm lint` / `pnpm typecheck`  | Verificações isoladas                                                                      |
| `pnpm test` / `pnpm test:watch` | Testes de unidade (Vitest)                                                                 |
| `pnpm test:db`                  | Testes de integração do banco (exige `VOLTA_TEST_DATABASE_URL` com as migrações aplicadas) |
| `pnpm test:e2e`                 | Testes ponta a ponta (Playwright; rode `pnpm exec playwright install` antes)               |
| `pnpm test:e2e:live`            | Fluxo real de autenticação, cupons e resultados com Cardápio Web e Supabase simulados      |
| `pnpm format`                   | Formata com Prettier                                                                       |
| `pnpm templates:export`         | Regenera `design/templates/html` a partir dos templates do canvas                          |
| `pnpm cw:types`                 | Regenera os tipos da API da CW a partir das especificações OpenAPI                         |

## Estrutura

```
src/
  app/                 rotas Next.js: telas e API (OAuth, SSO, webhooks, cron)
  application/         casos de uso e portas (interfaces) que eles usam
  domain/              regras de negócio puras: público, oferta, estados, métricas
  integrations/
    cardapio-web/      cliente da API da CW, OAuth/PKCE, cupons, webhooks, tipos gerados
  server/              configuração, banco (Supabase) e segurança — só no servidor
  components/ui/       componentes visuais (shadcn + variantes do Volta)
  copy/                textos da interface em pt-BR
  demo/                dados sintéticos do modo demonstração
  lib/                 utilitários compartilhados (cn)
design/                templates do canvas, tokens e referência visual
docs/                  produto, arquitetura, design, ADRs e plano do hackathon
supabase/migrations/   esquema do banco
.claude/skills/        skills para agentes de código usados no projeto
```

As regras de dependência entre as camadas estão em [`docs/engineering/conventions.md`](docs/engineering/conventions.md).

## Contribuindo

Leia [`CONTRIBUTING.md`](CONTRIBUTING.md). Em resumo: branch a partir de `main`, Conventional Commits em inglês, `pnpm check` verde e PR com comparação visual contra o template da tela.

## Licença

Ainda não definida. Até lá, todos os direitos reservados aos autores do squad.
