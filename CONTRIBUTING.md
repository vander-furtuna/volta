# Como contribuir

## Fluxo

1. Atualize a `main` e crie uma branch: `feat/audience-screen`, `fix/coupon-retry`, `docs/metrics`.
2. Trabalhe em pequenos commits seguindo [Conventional Commits](https://www.conventionalcommits.org) em inglês:
   - `feat(audience): freeze audience before offer step`
   - `fix(cw): re-send full coupon body on activation`
   - `docs(adr): record billing decision`
   - Tipos aceitos: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `ci`, `perf`.
3. Rode `pnpm check` antes de abrir o PR.
4. Abra o PR usando o template. Toda tela nova ou alterada leva captura lado a lado com o template de `design/templates/html`.
5. Pelo menos uma revisão antes do merge. Merge com squash.

## Gerenciador de pacotes

O projeto usa **pnpm 12**, fixado em `packageManager` no `package.json`. Instale dependências com `pnpm add <pacote>` (ou `pnpm add -D` para desenvolvimento) e rode ferramentas com `pnpm exec` ou `pnpm dlx`. Não use npm, npx ou yarn, e não faça commit de `package-lock.json` ou `yarn.lock`.

O pnpm 12 recusa versões publicadas há muito pouco tempo. Se precisar de uma delas, registre a exceção em `pnpm-workspace.yaml` (`minimumReleaseAgeExclude`) e justifique no PR.

## Padrões de código

O resumo está aqui; o detalhe, em [`docs/engineering/conventions.md`](docs/engineering/conventions.md).

- **Nomes em inglês** em código, arquivos, pastas, rotas, tabelas, variáveis de ambiente e commits. **Textos da interface em português**, em `src/copy` ou direto no JSX.
- **Camadas:** `domain` não importa framework nem infraestrutura. `application` depende de `domain` e de portas. `integrations` e `server` implementam as portas. `app` só orquestra.
- **Funções pequenas e puras** sempre que possível. Regras de negócio sempre testadas em `*.test.ts` ao lado do arquivo.
- **Validação nas bordas:** toda entrada externa (webhook, resposta da CW, formulário) passa por um schema Zod.
- **Sem números mágicos:** constantes nomeadas no topo do módulo.
- **Estilos:** tokens do Volta (`bg-forest`, `text-graphite`, `rounded-card`) em vez de hex soltos. Variantes com `cva`, composição com `cn`.
- **Acessibilidade:** elementos reais (`button`, `a`, `label`), foco visível, alvo mínimo de 44 px, contraste AA, status nunca só por cor.

## Fidelidade visual

`design/templates/source` é a fonte de verdade. Antes de implementar uma tela:

1. Abra o template correspondente em `design/templates/html/` no navegador e inspecione espaçamentos, tamanhos e cores.
2. Reaproveite os tokens e componentes existentes; crie variantes novas com `cva` em vez de classes avulsas.
3. Compare as duas versões lado a lado em 1440 px e 390 px antes do PR.

## Segredos

Nunca faça commit de `.env.local`, tokens da CW ou chaves do Supabase. Veja [`SECURITY.md`](SECURITY.md).
