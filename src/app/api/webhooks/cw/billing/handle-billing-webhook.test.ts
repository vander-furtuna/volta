import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as ordersPost } from "../orders/route";
import { handleBillingWebhook } from "./handle-billing-webhook";

const { saveIfNew, receiveOrder } = vi.hoisted(() => ({
  saveIfNew: vi.fn(),
  receiveOrder: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/database/repositories", () => ({
  supabaseBillingEventStore: { saveIfNew },
  supabaseOrderWebhookInbox: { receive: receiveOrder },
}));

const SECRET = "test-webhook-token";

/** Example from https://docs.cardapioweb.com/cobranca/eventos.md */
const accessEvent = {
  event_id: "169ee546-6d69-49ab-8ff0-4caf7de5cd43",
  event_type: "MARKETPLACE_APP_ACCESS_UPDATED",
  version: 1,
  sequence: 8,
  occurred_at: "2026-10-29T10:00:02.000-03:00",
  company_id: 100,
  marketplace_app_id: 42,
  installation_id: 500,
  entitlement: { allowed: true, reason: null, access_until: "2026-12-03T00:00:00-03:00" },
};

function billingRequest(
  body: Record<string, unknown>,
  options: { url?: string; secret?: string; headers?: Record<string, string> } = {},
) {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", options.secret ?? SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return new NextRequest(options.url ?? "http://localhost/api/webhooks/cw/billing", {
    method: "POST",
    body: rawBody,
    headers: {
      "content-type": "application/json",
      "x-cardapio-event-id": String(body.event_id),
      "x-cardapio-event-type": String(body.event_type),
      "x-cardapio-event-version": String(body.version),
      "x-cardapio-timestamp": timestamp,
      "x-cardapio-signature": `v1=${signature}`,
      ...options.headers,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CW_WEBHOOK_TOKEN", SECRET);
  saveIfNew.mockResolvedValue(true);
});

describe("handleBillingWebhook", () => {
  it("stores a signed access event with its store and answers 200", async () => {
    const response = await handleBillingWebhook(billingRequest(accessEvent));

    expect(response.status).toBe(200);
    expect(saveIfNew).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "cw_billing",
        eventId: accessEvent.event_id,
        eventType: "MARKETPLACE_APP_ACCESS_UPDATED",
        storeExternalId: 100,
        payload: accessEvent,
      }),
    );
  });

  it("confirms a repeated event without failing", async () => {
    saveIfNew.mockResolvedValue(false);
    const response = await handleBillingWebhook(billingRequest(accessEvent));
    expect(response.status).toBe(200);
  });

  it("refuses a bad signature with 401 and stores nothing", async () => {
    const response = await handleBillingWebhook(billingRequest(accessEvent, { secret: "other" }));
    expect(response.status).toBe(401);
    expect(saveIfNew).not.toHaveBeenCalled();
  });

  it("refuses headers that do not match the body", async () => {
    const response = await handleBillingWebhook(
      billingRequest(accessEvent, { headers: { "x-cardapio-event-id": "another-id" } }),
    );
    expect(response.status).toBe(400);
    expect(saveIfNew).not.toHaveBeenCalled();
  });

  it("refuses an access event without a valid entitlement", async () => {
    const response = await handleBillingWebhook(
      billingRequest({ ...accessEvent, entitlement: { reason: null } }),
    );
    expect(response.status).toBe(400);
    expect(saveIfNew).not.toHaveBeenCalled();
  });

  it("stores other billing events and unknown versions without applying them", async () => {
    const payment = {
      ...accessEvent,
      event_id: "0c1580a0-cc02-4d93-9cd1-a660b7c45a41",
      event_type: "MARKETPLACE_APP_PAYMENT_SUCCEEDED",
      payment: { id: 900 },
    };
    const futureVersion = { ...accessEvent, version: 2, entitlement: { shape: "new" } };

    expect((await handleBillingWebhook(billingRequest(payment))).status).toBe(200);
    expect((await handleBillingWebhook(billingRequest(futureVersion))).status).toBe(200);
    expect(saveIfNew).toHaveBeenCalledTimes(2);
  });

  it("answers 503 when the inbox cannot store the event, so CW retries", async () => {
    saveIfNew.mockRejectedValue(new Error("database unavailable"));
    const response = await handleBillingWebhook(billingRequest(accessEvent));
    expect(response.status).toBe(503);
  });
});

describe("orders webhook route", () => {
  it("forwards signed billing events sent to the app's single webhook_url", async () => {
    const response = await ordersPost(
      billingRequest(accessEvent, { url: "http://localhost/api/webhooks/cw/orders" }),
    );
    expect(response.status).toBe(200);
    expect(saveIfNew).toHaveBeenCalledTimes(1);
    expect(receiveOrder).not.toHaveBeenCalled();
  });

  it("still requires the order token for unsigned requests", async () => {
    const response = await ordersPost(
      new NextRequest("http://localhost/api/webhooks/cw/orders", {
        method: "POST",
        body: JSON.stringify(accessEvent),
      }),
    );
    expect(response.status).toBe(401);
    expect(saveIfNew).not.toHaveBeenCalled();
  });
});
