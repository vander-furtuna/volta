import { NextResponse, type NextRequest } from "next/server";
import { receiveOrderEvent } from "@/application/webhooks/receive-order-event";
import {
  isValidOrderWebhookToken,
  orderWebhookEventSchema,
} from "@/integrations/cardapio-web/webhooks";
import { readEnv } from "@/server/config/env";
import { supabaseOrderWebhookInbox } from "@/server/database/repositories";
import { PayloadTooLargeError, parseJson, readBodyText } from "@/server/http/read-body";
import { handleBillingWebhook, isSignedBillingWebhook } from "../billing/handle-billing-webhook";

/**
 * CW order webhooks. Order of operations follows the CW recommendation:
 * validate token → bound and parse the body → validate with Zod → store and schedule atomically
 * → respond 200 → process asynchronously. Any storage failure answers 503 so CW retries.
 */
export async function POST(request: NextRequest) {
  // CW sends billing events to the app's single webhook_url too, signed with HMAC instead of
  // X-Webhook-Token. The billing handler verifies that signature before trusting anything.
  if (isSignedBillingWebhook(request)) return handleBillingWebhook(request);

  const env = readEnv();
  if (!isValidOrderWebhookToken(request.headers.get("x-webhook-token"), env.CW_WEBHOOK_TOKEN)) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  let rawBody: string;
  try {
    rawBody = await readBodyText(request);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    throw error;
  }

  const parsed = orderWebhookEventSchema.safeParse(parseJson(rawBody));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const event = parsed.data;
  try {
    await receiveOrderEvent(
      {
        eventId: event.event_id,
        eventType: event.event_type,
        storeExternalId: event.merchant_id,
        orderId: event.order_id,
        payload: event,
        receivedAt: new Date(),
      },
      { inbox: supabaseOrderWebhookInbox },
    );
  } catch {
    // 503 makes CW retry. The failed write was rolled back, so the retry starts clean.
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }

  return NextResponse.json({ received: true });
}
