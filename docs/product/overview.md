# Visão do produto

## Problema

O restaurante dá desconto no escuro. Clientes frequentes param de comprar e ninguém percebe. O cupom vai para todo mundo, sem limite de custo, e depois ninguém sabe dizer se compensou. Os dados existem na Cardápio Web, mas falta tempo e método para transformá-los em decisão.

A CW já oferece CRM, cupons e mensagens. O que falta é ligar quatro perguntas num fluxo só:

1. Quem convidar a voltar?
2. Qual incentivo oferecer?
3. Quanto isso pode custar?
4. O que aconteceu depois?

## Proposta

> Transformar promoções de tentativa e erro em campanhas de recompra compreensíveis, controladas e mensuráveis.

- **Público explicável:** critério visível, conta passo a passo e motivo de cada exclusão.
- **Custo máximo antes de criar:** calculado na hora, com alertas de configuração.
- **Revisão antes de qualquer efeito:** o cupom nasce desativado; ativar e convidar são passos separados.
- **Resultado honesto:** separa o que foi medido (uso do cupom), o que foi observado (quem voltou) e o que não foi medido (efeito causal).
- **Integrado à CW:** instalação pela App Store, login pelo botão Acessar, sem cadastro novo.

## Para quem

- **Principal:** donos e gestores de restaurantes de delivery que usam a CW, com uma ou poucas unidades e sem equipe de marketing ou dados.
- **Primeiro alvo:** lojas com pedidos frequentes (hamburguerias, pizzarias, açaí) que já usam cupons e têm clientes identificados no cardápio digital.

## Escopo do hackathon (até 20/11)

**Entra na demonstração**

- Login pela CW (OAuth com PKCE; SSO se der tempo)
- Leitura de clientes e pedidos da loja de teste
- Montagem do público e da oferta com validações
- Criação do cupom desativado no sandbox e ativação
- Ligação de um pedido ao cupom pelo `coupon_id`
- Tela de resultado com as três camadas
- Modo demonstração com dados sintéticos rotulados

**Fica para depois**

- Grupo de comparação real (holdout)
- Várias unidades por conta
- Exportação CSV e link com cupom aplicado
- Tema escuro

## Modelo de negócio

Assinatura mensal por unidade, contratada e cobrada pela própria CW App Store via Stripe. A CW fica com 20% de cada cobrança. O Volta não tem checkout: libera ou bloqueia o uso pelos eventos de acesso da CW. Detalhes no [canvas de negócio](https://claude.ai/artifact/R16xt2x7JBqZpi4oAomaY8) e no [ADR 0002](../adr/0002-billing-handled-by-cw.md).
