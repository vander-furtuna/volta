# 0002. Cobrança feita pela CW App Store

- Status: Aceita
- Data: 17/11/2026

## Contexto

A [documentação de cobrança](https://docs.cardapioweb.com/cobranca/visao-geral.md) diz que a Cardápio Web coleta o cartão e faz as cobranças recorrentes pela Stripe (Connect, cobranças diretas), com taxa de plataforma de 20%. O app não deve cobrar, sob risco de cobrar o restaurante duas vezes.

## Decisão

O Volta não tem checkout. Ele recebe `MARKETPLACE_APP_ACCESS_UPDATED` (assinado com HMAC), guarda o estado em `store_access` e confere no servidor, a cada chamada protegida, se a loja pode usar o app. O período de teste é configurado no plano da CW.

## Consequências

- Receita por loja = 80% do preço, menos a tarifa da Stripe.
- Precisamos da ativação financeira na Stripe pela CW antes de publicar planos.
- O acesso expira em `access_until` mesmo se o próximo evento atrasar.
- Não existe endpoint de consulta de assinatura: o estado vem só dos webhooks.
