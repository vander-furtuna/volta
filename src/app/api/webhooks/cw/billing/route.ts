import { NextResponse, type NextRequest } from "next/server";
import { verifyBillingSignature } from "@/integrations/cardapio-web/webhooks";
import { readEnv } from "@/server/config/env";
import { supabaseWebhookEventStore } from "@/server/database/repositories";

/**
 * CW billing and access webhooks (MARKETPLACE_APP_*). CW charges the restaurant; Volta only
 * grants or blocks access from MARKETPLACE_APP_ACCESS_UPDATED. Keep accepting these events
 * even after uninstall. Source: https://docs.cardapioweb.com/cobranca/assinaturas-e-acesso.md
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
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

  try {
    await supabaseWebhookEventStore.saveIfNew({
      source: "cw_billing",
      eventId,
      eventType,
      storeExternalId: null,
      payload: JSON.parse(rawBody) as unknown,
      receivedAt: new Date(),
    });
  } catch {
    // 503 tells CW to retry later without losing the event.
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }

  // TODO(billing): apply MARKETPLACE_APP_ACCESS_UPDATED to store_access in a worker.
  return NextResponse.json({ received: true });
}
