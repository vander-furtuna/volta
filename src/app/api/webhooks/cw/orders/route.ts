import { NextResponse, type NextRequest } from "next/server";
import { receiveOrderEvent } from "@/application/webhooks/receive-order-event";
import {
  isValidOrderWebhookToken,
  orderWebhookEventSchema,
} from "@/integrations/cardapio-web/webhooks";
import { readEnv } from "@/server/config/env";
import { supabaseSyncJobQueue, supabaseWebhookEventStore } from "@/server/database/repositories";

/**
 * CW order webhooks. Order of operations follows the CW recommendation:
 * validate token → dedupe by event_id → persist → respond 200 → process asynchronously.
 */
export async function POST(request: NextRequest) {
  const env = readEnv();
  if (!isValidOrderWebhookToken(request.headers.get("x-webhook-token"), env.CW_WEBHOOK_TOKEN)) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const parsed = orderWebhookEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  await receiveOrderEvent(parsed.data, {
    events: supabaseWebhookEventStore,
    queue: supabaseSyncJobQueue,
  });
  return NextResponse.json({ received: true });
}
