# Integração com a Cardápio Web

Consultado em 17/11/2026 na [documentação oficial](https://docs.cardapioweb.com). Confirme qualquer detalhe novo na fonte antes de implementar.

## Ambientes

|                       | Sandbox                                          | Produção                                 |
| --------------------- | ------------------------------------------------ | ---------------------------------------- |
| Portal de autorização | `https://portal.sandbox.cardapioweb.com/cw-apps` | `https://portal.cardapioweb.com/cw-apps` |
| API                   | `https://integracao.sandbox.cardapioweb.com`     | `https://integracao.cardapioweb.com`     |

Cada app da App Store recebe um estabelecimento de teste próprio no sandbox, criado pelo suporte (`integracao@cardapioweb.com`). Os ambientes são isolados: cadastro, credenciais e tokens próprios.

## Cadastro do app

Pedir ao suporte: `client_id`, `webhook_token`, `redirect_uri` (`<APP_URL>/api/cw/oauth/callback`), `login_url` (`<APP_URL>/api/cw/sso`), `webhook_url` (`<APP_URL>/api/webhooks/cw/orders`) e o endereço dos webhooks de cobrança (`<APP_URL>/api/webhooks/cw/billing`).

Escopos: `auth`, `customers`, `orders`, `coupons`. O portal concede todos os cadastrados; ampliar depois exige reinstalação pelas lojas.

## OAuth 2.0 com PKCE — `src/integrations/cardapio-web/oauth.ts`

- Cliente público: **não existe `client_secret`**. A segurança depende do PKCE (`S256`, verifier de 43 a 128 caracteres).
- Autorização: `client_id`, `state`, `redirect_uri`, `code_challenge`, `code_challenge_method=S256`.
- Token: `POST /api/partner/oauth/token` (form-urlencoded). Resposta com `access_token`, `expires_in` (7200 s), `refresh_token`, `scope`.
- Renovação: `grant_type=refresh_token` no mesmo endpoint. **A CW não documenta se o refresh token é rotacionado:** sempre grave o último recebido e use `store_credentials.refreshing_since` como trava para uma renovação por vez.
- Revogação: `POST /api/partner/oauth/revoke`. Desinstalar o app revoga os tokens.
- Só o perfil Proprietário autoriza; outros recebem `access_denied`.
- **Nunca registre em log** token, code ou verifier.

## Onboarding e SSO — `src/app/api/cw/sso/route.ts`

- Depois da troca do código: `GET /api/partner/v1/identity/context` (escopo `auth`) devolve usuário e loja. Crie a conta sem formulário.
- Botão Acessar: a CW abre `login_url?ticket=ST-...&company_external_id=123`.
- Validação: `POST /api/partner/v1/identity/sso_tickets/validate` com `{ "ticket": "..." }` e o token **da mesma loja**. Sucesso: `valid: true`, `user`, `company`.
- Ticket de uso único. Se falhar (`401 invalid_ticket`), mostre o login normal e não reenvie.
- **A documentação não diz se o app abre em nova aba ou dentro do portal.** Se for iframe, o cookie de sessão precisa de `SameSite=None; Secure; Partitioned`. Pergunta em aberto.

## Limites — `src/integrations/cardapio-web/config.ts`

Por **loja**, não por app:

| Endpoint                                             | Limite                       |
| ---------------------------------------------------- | ---------------------------- |
| `GET /orders/history`, `/orders/summary`, `/catalog` | 5 por minuto cada            |
| `GET` e `PUT /merchant`                              | 5 por minuto (compartilhado) |
| Demais                                               | 300 a cada 3 minutos         |

O histórico aceita até 100 pedidos por página e janelas de até 6 meses. Em 429, reagende a tarefa; não insista.

## Cupons — `src/integrations/cardapio-web/coupons.ts`

- Criar: `POST /api/partner/v1/merchant/coupons` com `active: false`.
- Editar: `PUT /api/partner/v1/merchant/coupons/{id}` com **corpo completo** (`name`, `type`, `value` obrigatórios). Por isso guardamos o `coupon_input` exato em `campaigns`.
- Listar: só paginação (até 20 por página), **sem filtro por código e sem contador de usos**. O uso vem dos descontos dos pedidos.
- Sem `code`, o cupom fica visível para todos no cardápio. O Volta sempre exige código.
- Antes de repetir uma criação que falhou, procure pelo código (`findCouponByCode`) para não duplicar.

## Webhooks de pedido — `src/app/api/webhooks/cw/orders/route.ts`

- Configurados pela CW por instalação a partir da `webhook_url` do cadastro.
- Autenticação: cabeçalho `X-Webhook-Token`. Sem HMAC.
- Eventos: `ORDER_CREATED` e `ORDER_STATUS_UPDATED`, com `event_id`, `merchant_id` (= `company_id`), `order_id`, `order_status`, `created_at`.
- Responder **200 em até 5 s**. Até 15 retentativas (15 s a 15 min). Esgotadas, o aviso é **descartado e o webhook pausa**; reativar exige falar com o suporte.
- Ordem: validar token → deduplicar por `event_id` → gravar → responder → processar depois.
- Por isso existe a conciliação diária pelo histórico.

## Cobrança e acesso — `src/app/api/webhooks/cw/billing/route.ts`

- A CW cobra o restaurante (Stripe Connect, cobranças diretas). **O app não cobra.** Taxa da plataforma: 20%.
- Assinatura: `X-Cardapio-Signature: v1=<hex HMAC-SHA256>` sobre `${X-Cardapio-Timestamp}.${corpo original}`, com o `webhook_token`. Rejeitar diferenças de mais de 300 s. Comparar em tempo constante.
- Cabeçalhos: `X-Cardapio-Event-Id`, `X-Cardapio-Event-Type`, `X-Cardapio-Event-Version`, `X-Cardapio-Timestamp`.
- Respostas aceitas: 200, 202 ou 204. Use 401 para assinatura inválida e 503 quando o banco estiver fora.
- Idempotência: `(source, event_id)` único em `webhook_events`.
- Regra de acesso: liberar só se o último `MARKETPLACE_APP_ACCESS_UPDATED` tem `allowed = true` e `access_until` nulo ou futuro. Bloquear ao atingir `access_until` mesmo sem novo evento. Não reiniciar teste em reinstalação.
- Continuar aceitando esses eventos depois da desinstalação.

## Tipos gerados

`pnpm cw:types` gera `src/integrations/cardapio-web/generated/{auth,identity,store,orders}.ts` a partir das especificações OpenAPI publicadas. Não edite esses arquivos à mão.

## Fontes

- [OAuth](https://docs.cardapioweb.com/autenticacao/oauth.md)
- [Onboarding e acesso](https://docs.cardapioweb.com/cw-app-store/onboarding-e-acesso.md)
- [Sobre a API](https://docs.cardapioweb.com/sobre-a-api.md)
- [Webhooks de pedido](https://docs.cardapioweb.com/webhooks/visao-geral.md) e [eventos](https://docs.cardapioweb.com/webhooks/eventos.md)
- [Editar cupom](https://docs.cardapioweb.com/api-reference/loja/cupons/editar-cupom.md) e [listar cupons](https://docs.cardapioweb.com/api-reference/loja/cupons/listar-cupons.md)
- [Cobrança](https://docs.cardapioweb.com/cobranca/visao-geral.md), [assinaturas e acesso](https://docs.cardapioweb.com/cobranca/assinaturas-e-acesso.md) e [webhooks de cobrança](https://docs.cardapioweb.com/cobranca/webhooks.md)
- [Índice](https://docs.cardapioweb.com/llms.txt)
