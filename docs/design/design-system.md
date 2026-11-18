# Sistema visual

Fonte: artboard `design-system` do [canvas](https://claude.ai/artifact/PT96JSG5kdBuN3FdHyexMV). Tokens em `design/tokens.json`, aplicados em `src/app/globals.css`.

## Cores

| Token (código) | Nome no design | Hex | Uso |
| --- | --- | --- | --- |
| `forest` | Mata | `#143A28` | Painéis de decisão, botão escuro |
| `ember` | Brasa | `#CC4A14` | Só a ação principal da tela. Branco sobre ela: 4,6:1 |
| `sprout` | Broto | `#CFE57A` | Dados e destaques sobre o Mata. Nunca sobre fundo claro |
| `paper` | Papel | `#F5F6F1` | Fundo das telas |
| `well` | Poço | `#F1F3EE` | Área clara dentro de cards |
| `peach` / `leaf` / `mint` | Pêssego / Folha / Menta | `#FCE6D4` / `#DDEBC4` / `#E2F0DC` | Atalhos, avisos, confirmações |
| `ink` / `graphite` | Tinta / Grafite | `#14231B` / `#4D5B53` | Texto principal e de apoio |
| `chart-primary` / `chart-secondary` | — | `#2E7D50` / `#E0702F` | Séries de gráfico; sempre com rótulo direto |

As variáveis semânticas do shadcn (`--primary`, `--secondary`, `--muted`...) apontam para essas cores. Primary = Brasa, secondary = Mata.

## Tipografia

- **Títulos:** Bricolage Grotesque 500–700, `letter-spacing: -0.02em` (utilitário `font-heading`).
- **Texto:** Figtree 400–700. Números de tabelas e totais com `tabular`.
- Escala usada: 48 / 38 / 30 / 28 / 24 / 22 / 17 / 15 / 14 / 13 px.

## Forma

- Botões, chips e filtros em pílula. Altura do botão: 48 px.
- Cards com raio de 20 px (`rounded-card`); áreas internas com 14 px (`rounded-well`); painéis verdes com 28 px no desktop e 24 px no mobile.
- Largura máxima do conteúdo: 1240 px (`max-w-content`).

## Componentes

| Componente | Arquivo | Variantes |
| --- | --- | --- |
| Botão | `src/components/ui/button.tsx` | `primary`, `dark`, `outline`, `onDark`, `ghost`, `link`; tamanhos `default`, `compact`, `icon` |
| Chip de status | `src/components/ui/status-chip.tsx` | `draft`, `pending`, `active`, `closed`, `paused` |

A fazer: campo, interruptor, botões de escolha, card de campanha, painel de decisão, barra de progresso do assistente, gráfico de pontos, gráfico de barras.

## Voz e escrita

- Frases curtas, sentença em caixa normal, sem jargão de dados.
- O botão diz o que acontece, e o mesmo verbo volta na confirmação ("Criar cupom" → "Cupom criado").
- Erros dizem o que houve e o que fazer; não pedem desculpas.
- Números sempre com unidade e período. Diga quando foi a última atualização.

| Use | Evite |
| --- | --- |
| Sem pedido identificado há 30 dias | Clientes perdidos |
| Valor desses pedidos | Receita recuperada |
| Convites marcados como enviados | Campanha disparada |
| Até R$ 200 em descontos | Orçamento garantido |
