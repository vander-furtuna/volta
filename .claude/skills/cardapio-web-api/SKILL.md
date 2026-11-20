---
name: cardapio-web-api
description: Rules and gotchas for integrating with the Cardápio Web (CW) open API and CW App Store — OAuth with PKCE, SSO tickets, coupons, customers, orders, rate limits, order webhooks and billing webhooks. Use whenever code touches src/integrations/cardapio-web, src/app/api/cw, src/app/api/webhooks, src/app/api/cron or sync jobs.
---

# Cardápio Web API

Full reference with sources: `docs/architecture/cardapio-web-integration.md`.
Generated request/response types: `src/integrations/cardapio-web/generated/*.ts` (`pnpm cw:types`).
Always prefer those types and the official docs (https://docs.cardapioweb.com/llms.txt) over memory.

## Hard rules

1. **Public OAuth client.** No client secret. PKCE `S256` only. Exchange and refresh tokens on the
   server. Store tokens encrypted (`src/server/security/token-encryption.ts`).
2. **Never log** `access_token`, `refresh_token`, `code`, `code_verifier`, SSO tickets or phone numbers.
3. **Refresh carefully.** Access tokens last 7200 s. Refresh-token rotation is undocumented: always
   persist the newest refresh token and allow one refresh per store at a time
   (`store_credentials.refreshing_since`).
4. **Rate limits are per store.** Order history, order summary, catalog and merchant: 5 req/min.
   Everything else: 300 per 3 min. On 429, reschedule the job (`sync_jobs.run_after`); never loop.
5. **Order webhooks** (`X-Webhook-Token`): validate → dedupe by `event_id` → persist → return 200 in
   under 5 s → process later. Dropped events are never re-sent, so keep the daily reconciliation.
6. **Billing webhooks** (`X-Cardapio-Signature: v1=<hex>`): HMAC-SHA256 over
   `${X-Cardapio-Timestamp}.${raw body}` with the webhook token. Verify against the raw body string,
   reject timestamps off by more than 300 s, compare in constant time. Answer 200/202/204 only.
   They arrive at the app's single `webhook_url` (the orders route forwards signed requests).
7. **CW bills the restaurant.** Never add checkout, payment links or subscriptions. Gate access with
   the latest `MARKETPLACE_APP_ACCESS_UPDATED` (`allowed`, `access_until` exclusive) on every
   protected server call, through `isAccessAllowed` (`src/domain/access/store-access.ts`).
   Its `sequence` is per installation: never compare it across installations or event types.
8. **Coupons:**
   - Create with `active: false`; activation is a separate user action.
   - `PUT` requires the full body (`name`, `type`, `value`…). Re-send the stored `coupon_input`.
   - Always set `code`; a null code makes the coupon visible to every customer.
   - `new_customers_only: true` would block a repurchase audience — the domain rejects it.
   - List has no code filter and no usage counter. Before retrying a failed creation call
     `findCouponByCode`. Count usage from `order.discounts[].coupon_id`.
9. **One installation = one store unit.** Every query filters by store. Confirm the unit in the UI
   before any external effect.
10. **Map at the edges.** CW field names (`flat_discount`, `onsite`, `merchant_id`) stay inside
    `src/integrations/cardapio-web`. The domain uses its own English names
    (`fixed_amount`, `dine_in`, `storeExternalId`). See `coupon-mapper.ts`.

## Adding a new CW call

1. Find the endpoint in the generated types and the official page.
2. Add a small function in `src/integrations/cardapio-web/<resource>.ts` that takes a `CwClient`.
3. Validate the response with Zod if the generated type is loose.
4. Call it from a use case in `src/application`, never directly from a component.
5. Test it with a fake `fetchImpl` passed to `createCwClient`.
