import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_UPDATED_EVENT,
  SUPPORTED_ACCESS_EVENT_VERSION,
  accessUpdatedEventSchema,
  billingEventEnvelopeSchema,
  verifyBillingSignature,
} from "@/integrations/cardapio-web/webhooks";
import { readEnv } from "@/server/config/env";
import { supabaseBillingEventStore } from "@/server/database/repositories";
import { PayloadTooLargeError, parseJson, readBodyText } from "@/server/http/read-body";

/** CW signs billing webhooks; order webhooks carry X-Webhook-Token instead. */
export function isSignedBillingWebhook(request: NextRequest): boolean {
  return request.headers.get("x-cardapio-signature") !== null;
}

/**
 * CW billing and access webhooks (MARKETPLACE_APP_*). CW charges the restaurant; Volta only
 * grants or blocks access from MARKETPLACE_APP_ACCESS_UPDATED, applied later by the sync worker.
 * Keep accepting these events even after uninstall.
 * Source: https://docs.cardapioweb.com/cobranca/webhooks.md
 *
 * Order: verify the signature over the raw body → check headers against the body → validate →
 * store in the inbox → answer 200. Invalid bodies answer 400 and bad signatures 401, so CW does
 * not retry them. Storage failures answer 503, so it does. Never answer 201: CW counts it as a
 * failed delivery.
 *
 * Event types or versions Volta does not apply are still stored (quarantine) and confirmed.
 */
export async function handleBillingWebhook(request: NextRequest): Promise<NextResponse> {
  let rawBody: string;
  try {
    rawBody = await readBodyText(request);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    throw error;
  }

  const check = verifyBillingSignature({
    rawBody,
    timestamp: request.headers.get("x-cardapio-timestamp"),
    signature: request.headers.get("x-cardapio-signature"),
    secret: readEnv().CW_WEBHOOK_TOKEN,
  });
  if (!check.valid) {
    return NextResponse.json({ error: check.reason }, { status: 401 });
  }

  const eventId = request.headers.get("x-cardapio-event-id");
  const eventType = request.headers.get("x-cardapio-event-type");
  const eventVersion = request.headers.get("x-cardapio-event-version");
  if (!eventId || !eventType || !eventVersion) {
    return NextResponse.json({ error: "missing_event_headers" }, { status: 400 });
  }

  const body = parseJson(rawBody);
  const envelope = billingEventEnvelopeSchema.safeParse(body);
  if (!envelope.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const event = envelope.data;
  if (
    event.event_id !== eventId ||
    event.event_type !== eventType ||
    String(event.version) !== eventVersion
  ) {
    return NextResponse.json({ error: "headers_do_not_match_body" }, { status: 400 });
  }

  const isAppliedAccessEvent =
    event.event_type === ACCESS_UPDATED_EVENT && event.version === SUPPORTED_ACCESS_EVENT_VERSION;
  if (isAppliedAccessEvent && !accessUpdatedEventSchema.safeParse(body).success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    await supabaseBillingEventStore.saveIfNew({
      source: "cw_billing",
      eventId: event.event_id,
      eventType: event.event_type,
      storeExternalId: event.company_id,
      // The original body, as CW sent it. The worker validates it again before applying it.
      payload: body,
      receivedAt: new Date(),
    });
  } catch {
    // 503 tells CW to retry later without losing the event.
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }

  // A repeated event (same event_id) is confirmed again without new effects.
  return NextResponse.json({ received: true });
}
