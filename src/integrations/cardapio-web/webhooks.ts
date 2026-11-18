import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * CW sends two kinds of webhooks, each with its own authentication:
 *
 * 1. Orders (ORDER_CREATED, ORDER_STATUS_UPDATED): static token in the X-Webhook-Token header.
 *    Respond 200 within 5 s. After 15 retries the event is dropped and the webhook is paused,
 *    with no queue — hence the daily reconciliation job.
 *    Source: https://docs.cardapioweb.com/webhooks/visao-geral.md
 *
 * 2. Billing and access (MARKETPLACE_APP_*): hex HMAC-SHA256 keyed with the webhook token,
 *    sent in X-Cardapio-Signature (prefix "v1="), over `${X-Cardapio-Timestamp}.${raw body}`.
 *    Respond 200, 202 or 204. Source: https://docs.cardapioweb.com/cobranca/webhooks.md
 */

export const SIGNATURE_TOLERANCE_SECONDS = 300;
const SIGNATURE_PREFIX = "v1=";

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

export function isValidOrderWebhookToken(received: string | null, expected: string): boolean {
  if (!received || !expected) return false;
  return safeEqual(received, expected);
}

export const orderWebhookEventSchema = z.object({
  event_id: z.string(),
  event_type: z.enum(["ORDER_CREATED", "ORDER_STATUS_UPDATED"]),
  /** Same value as company_id in the OAuth flow */
  merchant_id: z.number(),
  order_id: z.number(),
  order_status: z.string(),
  created_at: z.string(),
});

export type OrderWebhookEvent = z.infer<typeof orderWebhookEventSchema>;

export type SignatureCheck =
  | { valid: true }
  | {
      valid: false;
      reason: "missing_headers" | "invalid_timestamp" | "stale_timestamp" | "bad_signature";
    };

/** CW docs do not pin the timestamp format: accept Unix seconds or an ISO 8601 string. */
function parseTimestamp(timestamp: string): number {
  return /^\d+$/.test(timestamp) ? Number(timestamp) * 1000 : Date.parse(timestamp);
}

export function verifyBillingSignature(params: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  now?: Date;
}): SignatureCheck {
  const { rawBody, timestamp, signature, secret, now = new Date() } = params;
  if (!timestamp || !signature || !secret) return { valid: false, reason: "missing_headers" };

  const sentAt = parseTimestamp(timestamp);
  if (!Number.isFinite(sentAt)) return { valid: false, reason: "invalid_timestamp" };
  if (Math.abs(now.getTime() - sentAt) / 1000 > SIGNATURE_TOLERANCE_SECONDS) {
    return { valid: false, reason: "stale_timestamp" };
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const received = signature.startsWith(SIGNATURE_PREFIX)
    ? signature.slice(SIGNATURE_PREFIX.length)
    : signature;
  return safeEqual(received, expected)
    ? { valid: true }
    : { valid: false, reason: "bad_signature" };
}
