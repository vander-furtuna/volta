# Skills do projeto

Instruções para agentes de código (Claude Code e outros que leem `.claude/skills` ou `AGENTS.md`). Cada pasta tem um `SKILL.md` que o agente carrega quando a tarefa combina com a descrição.

## Próprias do Volta

| Skill | Quando usar |
| --- | --- |
| `volta-screen-fidelity` | Implementar ou revisar telas com fidelidade aos templates |
| `cardapio-web-api` | Qualquer código que fale com a CW (OAuth, SSO, cupons, webhooks, sincronização) |
| `campaign-metrics` | Calcular, exibir ou nomear números e gráficos |
| `volta-ux-writing` | Escrever ou revisar textos da interface em pt-BR |

## De terceiros (fixadas em `skills-lock.json`)

| Skill | Origem | Para quê |
| --- | --- | --- |
| `vercel-react-best-practices` | vercel-labs/agent-skills | Desempenho e padrões de React e Next.js |
| `vercel-composition-patterns` | vercel-labs/agent-skills | Composição de componentes e APIs de props |
| `web-design-guidelines` | vercel-labs/agent-skills | Revisão de interface, acessibilidade e UX |
| `deploy-to-vercel` | vercel-labs/agent-skills | Deploy e variáveis de ambiente na Vercel |
| `shadcn` | shadcn/ui | Adicionar e customizar componentes shadcn |
| `supabase` | supabase/agent-skills | Uso do Supabase (banco, RLS, cron) |
| `supabase-postgres-best-practices` | supabase/agent-skills | Esquema, índices e consultas em Postgres |
| `frontend-design` | Anthropic (Apache 2.0, ver `LICENSE.txt`) | Direção visual e acabamento de interfaces |

## Manutenção

```bash
pnpm dlx skills list            # o que está instalado
pnpm dlx skills update -p       # atualiza as de terceiros e o skills-lock.json
pnpm dlx skills install         # restaura a partir do skills-lock.json
```

Revise o conteúdo antes de atualizar: skills rodam com as permissões do agente.
