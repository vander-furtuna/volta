# Design

| Pasta / arquivo | Conteúdo |
| --- | --- |
| `templates/source/*.dc.html` | **Fonte de verdade visual**, exportada do [canvas](https://claude.ai/artifact/PT96JSG5kdBuN3FdHyexMV). Não edite à mão |
| `templates/source/canvas-map.json` | Qual artboard do canvas corresponde a cada template |
| `templates/source/canvas-layout.json` | Posição das telas no canvas |
| `templates/html/` | Páginas estáticas geradas por `pnpm templates:export`. Abra `index.html` |
| `tokens.json` | Cores, tipografia, raios e tamanhos (também em `src/app/globals.css`) |
| `reference/easymart.png` | Referência visual que inspirou a interface |

## Como usar os templates

1. Abra `templates/html/index.html` no navegador.
2. Inspecione a tela com as ferramentas do navegador para pegar valores exatos (espaçamentos, tamanhos, cores).
3. Implemente com os tokens e componentes do projeto, não copiando o CSS inline.
4. Telas interativas (`offer`, `coupon-created` e as versões mobile) mostram só o estado inicial no HTML. Os outros estados estão na lógica do `<script>` do `.dc.html` e no modo Play do canvas.

## Atualizar a partir do canvas

1. Baixe o artboard alterado do canvas (veja `canvas-map.json`).
2. Salve por cima do arquivo correspondente em `templates/source/` e troque os links `href="X.dc.html"` pelos nomes em inglês.
3. Rode `pnpm templates:export` e faça commit dos dois.
