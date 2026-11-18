# 0005. pnpm 12 como gerenciador de pacotes

- Status: Aceita
- Data: 18/11/2026

## Contexto

O projeto começou com npm. O time prefere pnpm, que instala mais rápido, economiza disco e não deixa o código importar pacotes que não estão declarados no `package.json`.

## Decisão

Usar pnpm 12, com a versão exata fixada em `packageManager` (`pnpm@12.21.0`). O lockfile é `pnpm-lock.yaml`. As configurações do pnpm ficam em `pnpm-workspace.yaml`. A CI instala com `pnpm/action-setup` e `pnpm install --frozen-lockfile`.

## Consequências

- Qualquer pnpm recente troca sozinho para a versão fixada; `corepack enable pnpm` também funciona.
- O pnpm 12 bloqueia scripts de instalação de dependências até serem aprovados (`pnpm approve-builds`). Hoje nenhuma dependência precisa.
- O pnpm 12 recusa versões publicadas há pouco tempo. Exceções ficam em `minimumReleaseAgeExclude`, revisadas no PR.
- Scripts do projeto não chamam o gerenciador por subprocesso; usam as APIs Node das ferramentas, o que evita diferenças no Windows.
