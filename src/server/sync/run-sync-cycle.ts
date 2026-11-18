import "server-only";
import { processSyncJob } from "@/application/sync/process-sync-job";
import { createCwOrderSource } from "@/integrations/cardapio-web/orders";
import { createCwTokenRefresher } from "@/integrations/cardapio-web/installation";
import { previousDayInTimeZone } from "@/domain/shared/time";
import { readEnv, requireEnv } from "@/server/config/env";
import { supabaseStoreCredentialsRepository } from "@/server/database/store-repositories";
import {
  BUDGET_RULES,
  createSupabaseRequestBudget,
  supabaseOrderRepository,
  supabaseStoreRegistry,
  supabaseSyncJobRepository,
} from "@/server/database/sync-repositories";

/** Jobs handled per cron run. Small on purpose: each job may wait for a budget window. */
export const SYNC_BATCH_SIZE = 10;
/** A job held longer than this is assumed lost and can be claimed again. */
const LEASE_SECONDS = 300;
const STORE_TIME_ZONE = "America/Sao_Paulo";

/**
 * One sync cycle: queue yesterday's reconciliation for each store, then claim and process a batch
 * of due jobs. Safe to run from overlapping cron invocations: claims and budgets are atomic in the
 * database.
 */
export async function runSyncCycle(now: Date) {
  const env = readEnv();
  const deps = {
    jobs: supabaseSyncJobRepository,
    stores: supabaseStoreRegistry,
    credentials: supabaseStoreCredentialsRepository,
    refresher: createCwTokenRefresher({
      clientId: requireEnv("CW_CLIENT_ID", env),
      redirectUri: env.CW_REDIRECT_URI,
    }),
    budget: createSupabaseRequestBudget(),
    budgets: BUDGET_RULES,
    orders: supabaseOrderRepository,
    source: createCwOrderSource(),
  };

  const queuedReconciliations = await deps.jobs.enqueueDailyReconciliation(
    previousDayInTimeZone(now, STORE_TIME_ZONE),
    now,
  );
  const jobs = await deps.jobs.claim(SYNC_BATCH_SIZE, now, LEASE_SECONDS);
  for (const job of jobs) {
    await processSyncJob(job, new Date(), deps);
  }

  return { processedJobs: jobs.length, queuedReconciliations };
}
