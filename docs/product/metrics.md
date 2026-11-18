# Definição das métricas

Toda métrica mostrada ao gestor precisa de definição, denominador, fonte, período e exclusões. A implementação de referência está em `src/domain/metrics/campaign-results.ts` e `src/domain/audience/audience.ts`.

## Público

| Métrica                    | Definição                                                                                                                                  | Fonte                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| Clientes frequentes        | Clientes identificados com `minCompletedOrders` ou mais pedidos concluídos na janela                                                       | `orders` com `customer_external_id` |
| Na oportunidade            | Frequentes cujo último pedido concluído foi há mais de `minDaysSinceLastOrder` dias                                                        | idem                                |
| Exclusões                  | WhatsApp não autorizado (`notifications_enabled = false`), sem telefone, convidado pelo Volta há menos de `minDaysBetweenInvitations` dias | `customers`, `campaign_audience`    |
| Costuma pedir a cada       | Mediana dos dias entre pedidos consecutivos do cliente. Com menos de 2 pedidos, não existe                                                 | `orders`                            |
| Cobertura de identificação | Pedidos com cliente identificado ÷ todos os pedidos, por canal                                                                             | `orders`                            |

## Oferta

| Métrica                     | Definição                                                 |
| --------------------------- | --------------------------------------------------------- |
| Custo máximo (valor fixo)   | valor × limite de usos. Exato                             |
| Custo máximo (percentual)   | percentual × pedido médio do público × limite. Estimativa |
| Custo máximo (frete grátis) | taxa média de entrega × limite. Estimativa                |

O custo máximo não inclui mensagens, outras promoções nem custo da comida. Nunca chamar de "custo total".

## Resultado

**Janela:** do início da validade do cupom até o fim do acompanhamento (validade + 7 dias, por padrão).

| Camada     | Métrica                 | Definição                                                                                                     |
| ---------- | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Medido     | Pedidos com o cupom     | Pedidos **concluídos** na janela com um desconto `category = coupon` e `coupon_id` igual ao cupom da campanha |
| Medido     | Desconto concedido      | Soma dos descontos desses pedidos com `sponsor = merchant`. Descontos pagos pelo iFood não entram             |
| Medido     | Valor desses pedidos    | Soma do total pago pelo cliente (já líquido de descontos). **Não é lucro**                                    |
| Medido     | Cancelados excluídos    | Pedidos com o cupom que foram cancelados; saem de todas as somas                                              |
| Observado  | Voltaram com cupom      | Convidados (público congelado) com ao menos um pedido concluído com o cupom na janela                         |
| Observado  | Voltaram sem cupom      | Convidados com pedido concluído na janela, mas nenhum com o cupom                                             |
| Observado  | Sem pedido identificado | Convidados sem pedido identificado na janela. **Não é o mesmo que "não voltou"**                              |
| Vazamento  | Uso fora da lista       | Pedidos com o cupom de clientes fora do público ou sem cliente identificado                                   |
| Não medido | Efeito da campanha      | Exige grupo de comparação. Sem ele, a tela diz "não medido"                                                   |

## Palavras proibidas na interface

"Receita recuperada", "clientes perdidos", "ROI", "campanha disparada", "orçamento garantido". Use os termos da tabela acima.
