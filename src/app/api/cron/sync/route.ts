import { NextResponse, type NextRequest } from "next/server";
import { readEnv } from "@/server/config/env";

/**
 * Called by a scheduler (Vercel Cron or Supabase pg_cron + pg_net) every minute.
 * Each run processes at most a few jobs per store so the 5 req/min order-history limit holds.
 * Also runs the daily reconciliation, since CW drops order webhooks after its retries end.
 */
export async function GET(request: NextRequest) {
  const { CRON_SECRET } = readEnv();
  if (!CRON_SECRET || request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // TODO(sync): claim due rows from sync_jobs (FOR UPDATE SKIP LOCKED), call CW, upsert orders.
  return NextResponse.json({ processedJobs: 0 });
}
