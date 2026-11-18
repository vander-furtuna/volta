# Telas e fluxos

Cada tela tem um template em `design/templates/source` (fonte) e `design/templates/html` (para abrir no navegador). Desktop é desenhado em 1440 px e mobile em 390 px.

## Fluxo principal

| #   | Tela                            | Rota prevista             | Template desktop | Template mobile         | Interativa no canvas       |
| --- | ------------------------------- | ------------------------- | ---------------- | ----------------------- | -------------------------- |
| 1   | Início                          | `/`                       | `home`           | `mobile-home`           | não                        |
| 2   | Nova campanha: público          | `/campaigns/new/audience` | `audience`       | `mobile-audience`       | não                        |
| 3   | Nova campanha: oferta e limites | `/campaigns/new/offer`    | `offer`          | `mobile-offer`          | sim (custo e avisos)       |
| 4   | Nova campanha: revisão          | `/campaigns/new/review`   | `review`         | `mobile-review`         | não                        |
| 5   | Cupom criado e convite          | `/campaigns/[id]`         | `coupon-created` | `mobile-coupon-created` | sim (ativar, marcar envio) |
| 6   | Resultado da campanha           | `/campaigns/[id]/results` | `results`        | `mobile-results`        | não                        |

Telas interativas: os templates HTML exportados mostram só o estado inicial. Para ver os outros estados, use o modo Play no [canvas](https://claude.ai/artifact/PT96JSG5kdBuN3FdHyexMV) ou leia a lógica no `<script>` do `.dc.html`.

## Telas de apoio

| Template        | Conteúdo                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `design-system` | Cores, tipografia, botões, estados e regras de escrita                                             |
| `integration`   | Diagrama da integração com a CW App Store                                                          |
| `states`        | Estados vazios e de erro (sincronização, sem histórico, sem acesso, falha de criação, loja errada) |
| `reference`     | Referência visual (EasyMart) e o que foi aproveitado                                               |

## Regras que atravessam as telas

- Uma única ação principal (botão laranja) por tela.
- A unidade da loja aparece sempre no topo e é confirmada antes de criar o cupom.
- Toda tela com números diz quando os dados foram atualizados.
- O modo demonstração mostra o selo "Dados de demonstração".
- Navegação: barra superior no desktop; barra inferior com três abas no mobile; o assistente de nova campanha tem barra de progresso em 3 passos.
