import { NextResponse, type NextRequest } from "next/server";
import {
  billingWebhookBodySchema,
  verifyBillingSignature,
} from "@/integrations/cardapio-web/webhooks";
import { readEnv } from "@/server/config/env";
import { supabaseBillingEventStore } from "@/server/database/repositories";
import { PayloadTooLargeError, parseJson, readBodyText } from "@/server/http/read-body";

/**
 * CW billing and access webhooks (MARKETPLACE_APP_*). CW charges the restaurant; Volta only
 * grants or blocks access from MARKETPLACE_APP_ACCESS_UPDATED. Keep accepting these events
 * even after uninstall. Source: https://docs.cardapioweb.com/cobranca/assinaturas-e-acesso.md
 *
 * Order: verify the signature over the raw body → validate the body → store.
 * Invalid bodies answer 400, so CW does not retry them. Storage failures answer 503, so it does.
 */
export async function POST(request: NextRequest) {
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
  if (!eventId || !eventType) {
    return NextResponse.json({ error: "missing_event_headers" }, { status: 400 });
  }

  const body = billingWebhookBodySchema.safeParse(parseJson(rawBody));
  if (!body.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    await supabaseBillingEventStore.saveIfNew({
      source: "cw_billing",
      eventId,
      eventType,
      storeExternalId: null,
      payload: body.data,
      receivedAt: new Date(),
    });
  } catch {
    // 503 tells CW to retry later without losing the event.
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }

  // TODO(billing): apply MARKETPLACE_APP_ACCESS_UPDATED to store_access in a worker.
  return NextResponse.json({ received: true });
}
