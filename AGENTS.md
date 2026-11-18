<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Volta — guide for coding agents

Volta is a CW App Store app that helps restaurant managers run repurchase campaigns: pick an
explainable audience, build a capped offer, review it, create an inactive coupon on Cardápio Web (CW),
and read results honestly (measured vs. observed vs. not measured).

## Read before changing code

- Product and screens: `docs/product/overview.md`, `docs/product/screens-and-flows.md`
- Architecture and CW integration: `docs/architecture/overview.md`, `docs/architecture/cardapio-web-integration.md`
- Conventions (layers, naming, testing): `docs/engineering/conventions.md`
- Visual source of truth: `design/templates/source/*.dc.html` (rendered in `design/templates/html/`)
- Metric definitions: `docs/product/metrics.md`

## Non-negotiable rules

1. **English identifiers, Portuguese UI copy.** Code, files, routes, tables, env vars and commits in English.
   Every string the restaurant manager reads is pt-BR and lives in `src/copy` or the JSX.
2. **Layering.** `src/domain` is pure TypeScript (no Next, React, Supabase or CW imports — ESLint enforces it).
   `src/application` holds use cases and ports. `src/integrations` and `src/server` are adapters. `src/app` orchestrates.
3. **Validate every external input with Zod** (webhooks, CW responses, forms).
4. **Nothing reaches customers without explicit approval.** Coupons are created inactive; activation and
   "invitations sent" are separate user actions. Respect `src/domain/campaign/campaign-status.ts`.
5. **CW limits.** Order history: 5 requests/min per store. Order webhooks must answer 200 within 5 s and are
   dropped after retries, so persist first and process asynchronously. Billing is done by CW: never add checkout.
6. **Secrets.** Never log tokens, codes, PKCE verifiers, SSO tickets or customer phone numbers.
7. **UI.** Use Volta tokens (`bg-forest`, `text-graphite`, `rounded-card`), variants via `cva`, class merging via `cn`.
   Match the screen template at 1440 px and 390 px. Real `button`/`a`/`label` elements, 44 px targets, AA contrast.
8. **pnpm only.** The package manager is pnpm 12 (pinned in `package.json` → `packageManager`).
   Use `pnpm add`, `pnpm <script>`, `pnpm exec` and `pnpm dlx`; never npm, npx or yarn, and never
   commit a `package-lock.json` or `yarn.lock`.
9. **Tests.** Business rules ship with `*.test.ts` next to the file. Run `pnpm check` before finishing.

## Project skills

Task-specific instructions live in `.claude/skills/` (also readable by other agents):
`volta-screen-fidelity`, `cardapio-web-api`, `campaign-metrics`, `volta-ux-writing`, plus third-party
skills for Next.js/React, shadcn and Supabase. See `.claude/skills/README.md`.
