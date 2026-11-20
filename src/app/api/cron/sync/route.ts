import { NextResponse, type NextRequest } from "next/server";
import { readEnv } from "@/server/config/env";
import { secretsMatch } from "@/server/security/secret-compare";
import { runSyncCycle } from "@/server/sync/run-sync-cycle";

/**
 * Upper bound for one cycle, in seconds. Jobs never wait for a CW rate-limit window (they are
 * deferred instead), so a cycle is short; this only caps a slow CW or database. The pg_net call
 * in supabase/migrations/*_schedule_sync_cycle.sql uses the same limit as its timeout.
 */
export const maxDuration = 60;

/**
 * Called every minute by Supabase pg_cron + pg_net (`request_sync_cycle`). Vercel Cron is not
 * used: on the Hobby plan it runs at most once a day. Locally, run `pnpm cron:local`.
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
