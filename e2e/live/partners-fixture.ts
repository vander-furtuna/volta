import { strict as assert } from "node:assert";
import { createServer, type IncomingMessage } from "node:http";
import { once } from "node:events";
import type { CwCouponInput } from "../../src/integrations/cardapio-web/coupons";

export const storeId = "7a89bea5-ff58-46c3-b13e-e68eabb6a1dc";
export const campaignId = "7a89bea5-ff58-46c3-b13e-e68eabb6a1dd";
export const foreignCampaignId = "7a89bea5-ff58-46c3-b13e-e68eabb6a1de";
const userId = "7a89bea5-ff58-46c3-b13e-e68eabb6a1df";
const foreignStoreId = "7a89bea5-ff58-46c3-b13e-e68eabb6a1e0";
const frozenAt = "2026-11-19T15:00:00+00:00";
const couponId = 631;
const couponsPath = "/api/partner/v1/merchant/coupons";
const portal = "https://portal.sandbox.cardapioweb.com/cw-apps";

async function readBody(request: IncomingMessage) {
  const parts: Buffer[] = [];
  for await (const chunk of request) parts.push(Buffer.from(chunk));
  return Buffer.concat(parts).toString("utf8");
}

export async function startPartnerFixtures(baseURL: string) {
  const campaign = {
    id: campaignId,
    store_id: storeId,
    name: "Volta de teste",
    status: "audience_frozen",
    offer: {
      benefit: "fixed_amount",
      amount: 10,
      minimumOrderValue: 40,
      usageLimit: 20,
      oncePerCustomer: true,
      newCustomersOnly: false,
      couponCode: "VOLTA10",
      channels: ["delivery"],
      startsOn: "2026-11-20",
      endsOn: "2026-11-25",
    },
    coupon_code: null as string | null,
    coupon_input: null as CwCouponInput | null,
    coupon_external_id: null as number | null,
    audience_frozen_at: frozenAt,
    follow_up_ends_at: null,
    invitations_marked_at: null as string | null,
  };
  const foreignCampaign = {
    ...campaign,
    id: foreignCampaignId,
    store_id: foreignStoreId,
    name: "Campanha de outra loja",
  };
  const access = { allowed: true, access_until: null as string | null };
  const errors: unknown[] = [];
  const requests: CwCouponInput[] = [];
  const responseLimits: { create?: number | null; activate?: number | null } = {};
  let installedCredentials: object | undefined;
  let storedCoupon: (CwCouponInput & { id: number }) | null = null;
  const orders: ReturnType<typeof completedOrder>[] = [];

  function completedOrder(number: number, usedCoupon: boolean) {
    return {
      id: `7a89bea5-ff58-46c3-b13e-${String(number).padStart(12, "0")}`,
      external_id: number,
      customer_external_id: 42,
      outcome: "completed",
      total: 65,
      sales_channel: "menu",
      placed_at: "2026-11-22T17:00:00+00:00",
      synced_at: "2026-11-22T17:01:00+00:00",
      order_discounts: usedCoupon
        ? [{ category: "coupon", coupon_external_id: couponId, amount: 10, sponsor: "merchant" }]
        : [],
    };
  }

  const fixture = createServer(async (req, res) => {
    const { pathname, searchParams: query } = new URL(req.url ?? "/", baseURL);
    const json = (value: unknown, status = 200) =>
      res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(value));
    try {
      if (pathname === "/api/partner/oauth/token" && req.method === "POST") {
        const form = new URLSearchParams(await readBody(req));
        assert.equal(form.get("code"), "fixture-oauth-code");
        assert.equal(form.get("grant_type"), "authorization_code");
        assert.match(form.get("code_verifier") ?? "", /^[A-Za-z0-9._~-]{43,128}$/);
        return json({
          access_token: "store-fixture",
          refresh_token: "refresh-fixture",
          token_type: "Bearer",
          expires_in: 7200,
        });
      }
      if (pathname.startsWith("/api/partner/")) {
        assert.equal(req.headers.authorization, "Bearer store-fixture");
      }
      if (pathname === "/api/partner/v1/identity/context") {
        return json({
          user: { id: 42, name: "Gestora de teste", email: null },
          company: { id: 111, name: "Loja de teste" },
          application: { id: "volta-fixture", name: "Volta" },
          scopes: ["auth", "customers", "orders", "coupons"],
        });
      }
      if (pathname === "/rest/v1/rpc/upsert_store_installation") {
        const body = JSON.parse(await readBody(req));
        assert.equal(body.p_external_id, 111);
        assert.equal(body.p_user_external_id, 42);
        installedCredentials = {
          access_token_encrypted: body.p_access_token_encrypted,
          refresh_token_encrypted: body.p_refresh_token_encrypted,
          access_token_expires_at: body.p_access_token_expires_at,
          stores: { environment: body.p_environment },
        };
        return json(storeId);
      }
      if (pathname === "/rest/v1/users") {
        assert.equal(query.get("store_id"), `eq.${storeId}`);
        return json(
          installedCredentials && query.get("external_id") === "eq.42"
            ? [
                {
                  id: userId,
                  stores: { name: "Loja de teste", uninstalled_at: null, store_access: access },
                },
              ]
            : [],
        );
      }
      if (pathname === "/rest/v1/store_credentials") {
        assert.equal(query.get("store_id"), `eq.${storeId}`);
        return json(installedCredentials ? [installedCredentials] : []);
      }
      if (pathname === "/rest/v1/campaigns") {
        assert.equal(query.get("store_id"), `eq.${storeId}`);
        if (query.get("id") === `eq.${foreignCampaign.id}`) return json([]);
        if (req.method === "PATCH") {
          assert.equal(query.get("id"), `eq.${campaignId}`);
          assert.equal(query.get("audience_frozen_at"), `eq.${frozenAt}`);
          assert.equal(query.get("coupon_input"), "is.null");
          if (campaign.coupon_input || campaign.status !== "audience_frozen") return json([]);
          const update = JSON.parse(await readBody(req));
          campaign.coupon_input = update.coupon_input;
          campaign.coupon_code = update.coupon_code;
          return json([{ id: campaignId }]);
        }
        return json([campaign]);
      }
      if (pathname === "/rest/v1/campaign_audience") {
        assert.equal(query.get("campaigns.store_id"), `eq.${storeId}`);
        assert.equal(query.get("campaign_id"), `eq.${campaignId}`);
        assert.equal(query.get("included"), "eq.true");
        if (req.method === "HEAD") return res.writeHead(200, { "content-range": "0-0/1" }).end();
        return json([{ customer_external_id: 42 }]);
      }
      if (pathname === "/rest/v1/rpc/record_campaign_coupon") {
        const body = JSON.parse(await readBody(req));
        assert.equal(body.p_store_id, storeId);
        assert.equal(body.p_user_id, userId);
        assert.equal(body.p_campaign_id, campaignId);
        assert.equal(body.p_from, campaign.status);
        campaign.status = body.p_to;
        if (body.p_coupon_id !== null) campaign.coupon_external_id = body.p_coupon_id;
        if (body.p_release_creation) campaign.coupon_input = null;
        if (body.p_event === "mark_invitations_sent") campaign.invitations_marked_at = frozenAt;
        return json(true);
      }
      if (pathname === "/rest/v1/orders") {
        assert.equal(query.get("store_id"), `eq.${storeId}`);
        assert.equal(query.getAll("placed_at").length, 2);
        return json(orders);
      }
      if (pathname === couponsPath && req.method === "GET") {
        const coupons = storedCoupon ? [storedCoupon] : [];
        return json({
          coupons,
          pagination: {
            current_page: 1,
            total_pages: coupons.length,
            total_coupons: coupons.length,
          },
        });
      }
      if (pathname === couponsPath && req.method === "POST") {
        const body = JSON.parse(await readBody(req)) as CwCouponInput;
        requests.push(body);
        assert.equal(body.active, false);
        assert.equal(body.code, "VOLTA10");
        if (requests.length === 1 && responseLimits.create === undefined) {
          return json({ error: "rate_limited" }, 429);
        }
        assert.equal(storedCoupon, null);
        storedCoupon = { ...body, id: couponId };
        if (responseLimits.create !== undefined) {
          storedCoupon.use_limit = responseLimits.create;
          return json(storedCoupon, 201);
        }
        // The upstream persisted the coupon, but Volta received a gateway error.
        return json({ error: "gateway_unavailable" }, 503);
      }
      if (pathname === `${couponsPath}/${couponId}` && req.method === "PUT") {
        assert(storedCoupon && campaign.coupon_input);
        const body = JSON.parse(await readBody(req)) as CwCouponInput;
        assert.deepEqual(body, { ...campaign.coupon_input, active: body.active });
        storedCoupon = { ...storedCoupon, ...body };
        if (body.active && responseLimits.activate !== undefined) {
          storedCoupon.use_limit = responseLimits.activate;
        }
        return json(storedCoupon);
      }
      throw new Error(`Unexpected fixture request ${req.method} ${pathname}`);
    } catch (error) {
      errors.push(error);
      return json({ error: "fixture assertion failed" }, 500);
    }
  });

  fixture.listen(Number(new URL(baseURL).port) + 1, "127.0.0.1");
  await once(fixture, "listening");

  return {
    access,
    errors,
    requests,
    portal,
    responseLimits,
    get coupon() {
      return storedCoupon;
    },
    addOrder: (number: number, usedCoupon: boolean) =>
      orders.push(completedOrder(number, usedCoupon)),
    close: () =>
      new Promise<void>((resolve, reject) =>
        fixture.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
