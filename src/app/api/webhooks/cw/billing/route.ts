import type { NextRequest } from "next/server";
import { handleBillingWebhook } from "./handle-billing-webhook";

/**
 * Dedicated address for CW billing and access webhooks. CW may also send them to the app's
 * single webhook_url (the orders route), which forwards signed requests to the same handler.
 */
export async function POST(request: NextRequest) {
  return handleBillingWebhook(request);
}
