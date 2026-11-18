# Convenções de engenharia

## Idioma

| O quê                                    | Idioma    | Exemplo                                                       |
| ---------------------------------------- | --------- | ------------------------------------------------------------- |
| Identificadores, arquivos, pastas, rotas | inglês    | `buildAudience`, `campaign-status.ts`, `/campaigns/new/offer` |
| Tabelas, colunas, variáveis de ambiente  | inglês    | `campaign_audience`, `CW_WEBHOOK_TOKEN`                       |
| Comentários de código, commits, branches | inglês    | `feat(offer): warn when minimum exceeds average order`        |
| Textos da interface                      | português | `src/copy/pt-BR.ts`, JSX                                      |
| Documentação em `docs/`                  | português | este arquivo                                                  |

Os nomes do design (Mata, Brasa, Broto) aparecem em `design/tokens.json` como `designName`, para a conversa com o design.

## Nomes

- Arquivos e pastas em `kebab-case`. Componentes React em `PascalCase` dentro do arquivo.
- Funções com verbo: `buildAudience`, `validateOffer`, `computeCampaignResults`.
- Booleanos com prefixo: `is`, `has`, `can`, `allows`.
- Tipos de união com literais em `snake_case` quando espelham o banco (`"invitations_sent"`).
- Constantes de módulo em `SCREAMING_SNAKE_CASE`.
- Sem abreviações obscuras: `customer`, não `cust`.

## Camadas

```
src/domain        regras puras; sem Next, React, Supabase nem CW
src/application   casos de uso + portas (interfaces) para o que é externo
src/integrations  adaptadores de APIs externas (CW)
src/server        configuração, banco e segurança (import "server-only")
src/app           rotas e telas: orquestram, não decidem regras
src/components    componentes visuais
src/copy          textos pt-BR
```

- Regras de negócio entram em `domain` e são testadas lá.
- Rotas de API fazem: autenticar → validar com Zod → chamar caso de uso → responder.
- O domínio devolve **códigos** (`missing_coupon_code`); a interface traduz com `src/copy`.

## TypeScript

- `strict`, `noUncheckedIndexedAccess` e `noImplicitOverride` ligados.
- Sem `any`. Use `unknown` e valide.
- Tipos importados com `import type` (regra do ESLint).
- Exporte só o necessário; nada de barrels (`index.ts`) que reexportam tudo.

## Erros

- Classes de erro específicas por fronteira (`OAuthError`, `CwApiError`, `InvalidTransitionError`).
- Rotas convertem erros conhecidos em status HTTP; erros desconhecidos sobem para o log.
- Nunca inclua segredos ou dados pessoais em mensagens de erro.

## Testes

- Vitest para domínio, aplicação e integrações (`*.test.ts` ao lado do arquivo).
- Casos de uso testados com portas em memória, sem banco.
- Playwright em `e2e/` para fluxos completos, em desktop e mobile.
- Nome do teste descreve o comportamento: `"blocks a coupon without code, which would be visible to every customer"`.

## Interface

- Tokens do Volta (`bg-forest`, `text-graphite`, `rounded-card`). Hex solto só em `globals.css`.
- Variantes com `cva`; composição de classes com `cn` (`@/lib/utils`).
- Componentes novos do shadcn: `pnpm dlx shadcn@latest add <componente>`; as variáveis semânticas já apontam para a paleta do Volta.
- Elementos reais (`button`, `a`, `label`), alvo de toque de 44 px, contraste AA, foco visível, status com texto e não só cor.

## Formatação e verificação

- Prettier (largura 100, Tailwind ordenado pelo plugin) e ESLint.
- `pnpm check` precisa passar antes de qualquer PR; a CI roda o mesmo.
