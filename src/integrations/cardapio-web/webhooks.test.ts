import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  accessUpdatedEventSchema,
  billingEventEnvelopeSchema,
  isValidOrderWebhookToken,
  orderWebhookEventSchema,
  verifyBillingSignature,
} from "./webhooks";

describe("orderWebhookEventSchema", () => {
  const valid = {
    event_id: "evt_1",
    event_type: "ORDER_CREATED",
    merchant_id: 123,
    order_id: 90412,
    order_status: "pending",
    created_at: "2026-11-17T22:00:00Z",
  };

  it("accepts a well-formed order event", () => {
    expect(orderWebhookEventSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects unknown event types, missing ids and wrong types", () => {
    expect(
      orderWebhookEventSchema.safeParse({ ...valid, event_type: "ORDER_DELETED" }).success,
    ).toBe(false);
    expect(orderWebhookEventSchema.safeParse({ ...valid, order_id: undefined }).success).toBe(
      false,
    );
    expect(orderWebhookEventSchema.safeParse({ ...valid, merchant_id: "123" }).success).toBe(false);
    expect(orderWebhookEventSchema.safeParse(null).success).toBe(false);
  });
});

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
  entitlement: {
    allowed: true,
    reason: null,
    access_until: "2026-12-03T00:00:00-03:00",
  },
};

describe("billingEventEnvelopeSchema", () => {
  it("accepts every billing event type and keeps unknown fields", () => {
    const payment = {
      ...accessEvent,
      event_type: "MARKETPLACE_APP_PAYMENT_SUCCEEDED",
      payment: { id: 900 },
    };
    const parsed = billingEventEnvelopeSchema.parse(payment);
    expect(parsed.company_id).toBe(100);
    expect(parsed).toHaveProperty("payment", { id: 900 });
  });

  it("accepts a company id sent as text, without losing it", () => {
    expect(billingEventEnvelopeSchema.parse({ ...accessEvent, company_id: "100" }).company_id).toBe(
      100,
    );
  });

  it("rejects bodies without the envelope fields", () => {
    expect(billingEventEnvelopeSchema.safeParse({ event: "X" }).success).toBe(false);
    expect(billingEventEnvelopeSchema.safeParse([]).success).toBe(false);
    expect(billingEventEnvelopeSchema.safeParse(null).success).toBe(false);
    expect(billingEventEnvelopeSchema.safeParse({ ...accessEvent, sequence: 0 }).success).toBe(
      false,
    );
    expect(
      billingEventEnvelopeSchema.safeParse({ ...accessEvent, company_id: "12a" }).success,
    ).toBe(false);
  });
});

describe("accessUpdatedEventSchema", () => {
  it("accepts the documented access event", () => {
    const parsed = accessUpdatedEventSchema.parse(accessEvent);
    expect(parsed.installation_id).toBe(500);
    expect(parsed.entitlement).toMatchObject({ allowed: true, reason: null });
  });

  it("accepts a block with a reason and an optional transition", () => {
    const blocked = {
      ...accessEvent,
      entitlement: {
        allowed: false,
        reason: "cardapio_unavailable",
        access_until: null,
        transition: { kind: "free_to_paid", free_access_ends_on: "2026-11-15" },
      },
    };
    expect(accessUpdatedEventSchema.safeParse(blocked).success).toBe(true);
  });

  it("refuses versions it does not know how to apply", () => {
    expect(accessUpdatedEventSchema.safeParse({ ...accessEvent, version: 2 }).success).toBe(false);
  });

  it("refuses an entitlement without allowed or with a date lacking its time zone", () => {
    expect(
      accessUpdatedEventSchema.safeParse({
        ...accessEvent,
        entitlement: { reason: null, access_until: null },
      }).success,
    ).toBe(false);
    expect(
      accessUpdatedEventSchema.safeParse({
        ...accessEvent,
        entitlement: { allowed: true, reason: null, access_until: "2026-12-03" },
      }).success,
    ).toBe(false);
  });
});

const SECRET = "test-webhook-token";
const rawBody = '{"event":"MARKETPLACE_APP_ACCESS_UPDATED","allowed":true}';
const now = new Date("2026-11-17T22:00:00Z");
const timestamp = String(Math.floor(now.getTime() / 1000));
const sign = (ts: string, body: string) =>
  `v1=${createHmac("sha256", SECRET).update(`${ts}.${body}`).digest("hex")}`;

describe("isValidOrderWebhookToken", () => {
  it("accepts only the exact token", () => {
    expect(isValidOrderWebhookToken(SECRET, SECRET)).toBe(true);
    expect(isValidOrderWebhookToken("wrong", SECRET)).toBe(false);
    expect(isValidOrderWebhookToken(null, SECRET)).toBe(false);
    expect(isValidOrderWebhookToken(SECRET, "")).toBe(false);
  });
});

describe("verifyBillingSignature", () => {
  it("accepts a signature over timestamp and raw body", () => {
    expect(
      verifyBillingSignature({
        rawBody,
        timestamp,
        signature: sign(timestamp, rawBody),
        secret: SECRET,
        now,
      }),
    ).toEqual({
      valid: true,
    });
  });

  it("rejects a body that was re-serialized or tampered with", () => {
    const check = verifyBillingSignature({
      rawBody: rawBody.replace("true", "false"),
      timestamp,
      signature: sign(timestamp, rawBody),
      secret: SECRET,
      now,
    });
    expect(check).toEqual({ valid: false, reason: "bad_signature" });
  });

  it("rejects timestamps older than five minutes", () => {
    const old = String(Number(timestamp) - 301);
    const check = verifyBillingSignature({
      rawBody,
      timestamp: old,
      signature: sign(old, rawBody),
      secret: SECRET,
      now,
    });
    expect(check).toEqual({ valid: false, reason: "stale_timestamp" });
  });
});
