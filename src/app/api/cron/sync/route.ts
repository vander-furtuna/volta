import { NextResponse, type NextRequest } from "next/server";
import { readEnv } from "@/server/config/env";
import { secretsMatch } from "@/server/security/secret-compare";
import { runSyncCycle } from "@/server/sync/run-sync-cycle";

/**
 * Called by a scheduler every minute (Vercel Cron, or Supabase pg_cron + pg_net).
 * Processes a small batch of due sync jobs. Each store's CW budgets are enforced by the worker,
 * so the 5-requests-per-minute order history limit holds even when runs overlap.
 */
export async function GET(request: NextRequest) {
  const { CRON_SECRET } = readEnv();
  if (
    !CRON_SECRET ||
    !secretsMatch(request.headers.get("authorization"), `Bearer ${CRON_SECRET}`)
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runSyncCycle(new Date());
  return NextResponse.json(result);
}
