---
name: volta-screen-fidelity
description: Implement or review a Volta screen so it matches its design template pixel-for-pixel. Use whenever building, changing or reviewing any page or component under src/app or src/components, or when someone mentions a screen name (home, audience, offer, review, coupon-created, results, states) or "template".
---

# Volta screen fidelity

The visual source of truth is `design/templates/source/<screen>.dc.html`. Its static render is
`design/templates/html/<screen>.html` (open `index.html` for the gallery). Mobile versions are the
`mobile-*` files. Never invent layout, copy or colors that are not in the template.

## Workflow

1. **Find the template.** Map the route to the template in `docs/product/screens-and-flows.md`.
   Read the `.dc.html` source for exact values (inline styles) and, for interactive screens
   (`offer`, `coupon-created`, mobile variants), the `<script>` logic that drives each state.
2. **Extract structure first.** List the sections top to bottom, their semantic elements
   (`header`, `nav`, `section` with `aria-labelledby`, `dl`, `table`) and the copy, verbatim.
3. **Translate values to tokens** using the table below. A hex value that has no token is a design
   bug: ask before adding a token, and add it to both `design/tokens.json` and `src/app/globals.css`.
4. **Reuse components** from `src/components/ui`. New visual variants go into the component's `cva`
   config, never as one-off class strings. Merge classes with `cn` from `@/lib/utils`.
   Need a primitive (dialog, switch, tabs)? `pnpm dlx shadcn@latest add <name>` — semantic variables are
   already mapped to the Volta palette.
5. **Put rules in the domain.** Numbers, validation and states come from `src/domain/*`; user-facing
   text from `src/copy/pt-BR.ts` or the template copy. Components only render.
6. **Make it responsive the template way.** Desktop is designed at 1440 px, mobile at 390 px.
   Desktop top nav becomes a 3-tab bottom bar on mobile; tables become stacked lists; the wizard
   gets a 3-segment progress bar; primary actions become full-width and sit at the bottom.
7. **Verify visually.** Run the app and capture both widths, then compare with the template:
   ```bash
   pnpm dev
   pnpm exec playwright screenshot --viewport-size=1440,900 --full-page http://localhost:3000/<route> /tmp/app.png
   pnpm exec playwright screenshot --viewport-size=1440,900 --full-page design/templates/html/<screen>.html /tmp/template.png
   ```
   Repeat at `390,844` with the `mobile-<screen>.html` template. Attach both pairs to the PR.

## Token map (template hex → Tailwind utility)

| Hex | Utility suffix | Design name |
| --- | --- | --- |
| `#143A28` | `forest` | Mata |
| `#0E2A1D` | `forest-deep` | Mata escura |
| `#CC4A14` | `ember` (also `primary`) | Brasa |
| `#B23F10` | `ember-deep` | Brasa escura |
| `#CFE57A` | `sprout` | Broto |
| `#F5F6F1` | `paper` (also `background`) | Papel |
| `#FFFFFF` | `surface` (also `card`) | Superfície |
| `#F1F3EE` | `well` (also `muted`) | Poço |
| `#E3E6DF` | `border` | Linha |
| `#ECEEE9` | `border-soft` / `status-draft` | Linha suave |
| `#C9D0C6` | `border-input` (also `input`) | Borda de campo |
| `#14231B` | `ink` (also `foreground`) | Tinta |
| `#4D5B53` | `graphite` (also `muted-foreground`) | Grafite |
| `#FCE6D4` | `peach` / `status-pending` | Pêssego |
| `#5A2306` | `peach-ink` | — |
| `#DDEBC4` | `leaf` | Folha |
| `#E2F0DC` | `mint` / `status-active` | Menta |
| `#173F27` | `mint-ink` | — |
| `#2E7D50`, `#E0702F`, `#DDE2DA` | `chart-primary`, `chart-secondary`, `chart-rest` | — |

Radii: 12 → `rounded-field`, 14 → `rounded-well`, 20 → `rounded-card`, 28 → `rounded-panel`,
999 → `rounded-full`. Max width 1240 → `max-w-content`. Headings use `font-heading`; numbers in
tables and totals use `tabular`.

## Checklist before opening the PR

- [ ] Same sections, order and copy as the template (pt-BR, sentence case)
- [ ] Only Volta tokens; no raw hex outside `globals.css`
- [ ] Exactly one `primary` button on the screen
- [ ] Real `button`, `a`, `label`; icon-only buttons have `aria-label`; decorative SVG `aria-hidden`
- [ ] Touch targets ≥ 44 px; visible focus; AA contrast
- [ ] Status shown with text plus dot, never color alone
- [ ] "Dados de demonstração" badge when `DEMO_MODE=true`
- [ ] Screenshots at 1440 px and 390 px compared with the templates
