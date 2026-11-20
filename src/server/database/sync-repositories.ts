import "server-only";
import { z } from "zod";
import type {
  CwBudget,
  OrderRepository,
  OrderSnapshot,
  RequestBudget,
  StoreRegistry,
  SyncJob,
  SyncJobRepository,
  SyncJobType,
} from "@/application/ports";
import { CW_RATE_LIMITS } from "@/integrations/cardapio-web/config";
import { fromCents } from "@/domain/shared/money";
import { outcomeFromStatus } from "@/domain/order/outcome";
import { isAccessAllowed } from "@/domain/access/store-access";
import { getServiceClient } from "./supabase";

const UNIQUE_VIOLATION = "23505";

/** Per-store budgets, from the CW rate limits. The window is converted to seconds. */
export const BUDGET_RULES = {
  orderHistory: {
    maxRequests: CW_RATE_LIMITS.orderHistory.requests,
    windowSeconds: CW_RATE_LIMITS.orderHistory.windowMs / 1000,
  },
  orderDetails: {
    maxRequests: CW_RATE_LIMITS.default.requests,
    windowSeconds: CW_RATE_LIMITS.default.windowMs / 1000,
  },
} as const;

const jobRowSchema = z.object({
  id: z.number().int(),
  job_type: z.enum([
    "fetch_order_details",
    "backfill_order_history",
    "sync_customers",
    "daily_reconciliation",
  ]),
  store_external_id: z.number().int(),
  payload: z.unknown(),
  attempts: z.number().int(),
});

function toSyncJob(row: unknown): SyncJob {
  const parsed = jobRowSchema.parse(row);
  return {
    id: parsed.id,
    jobType: parsed.job_type as SyncJobType,
    storeExternalId: parsed.store_external_id,
    payload: parsed.payload,
    attempts: parsed.attempts,
  };
}

export const supabaseSyncJobRepository: SyncJobRepository = {
  async claim(limit, now, leaseSeconds) {
    const { data, error } = await getServiceClient().rpc("claim_sync_jobs", {
      p_limit: limit,
      p_now: now.toISOString(),
      p_lease_seconds: leaseSeconds,
    });
    if (error) throw error;
    return z
      .array(z.unknown())
      .parse(data ?? [])
      .map(toSyncJob);
  },

  async complete(id) {
    const { error } = await getServiceClient().rpc("complete_sync_job", { p_id: id });
    if (error) throw error;
  },

  async reschedule(id, runAfter, error, countsAsAttempt) {
    const { error: rpcError } = await getServiceClient().rpc("reschedule_sync_job", {
      p_id: id,
      p_run_after: runAfter.toISOString(),
      p_error: error.slice(0, 500),
      p_counts_as_attempt: countsAsAttempt,
    });
    if (rpcError) throw rpcError;
  },

  async fail(id, error) {
    const { error: rpcError } = await getServiceClient().rpc("fail_sync_job", {
      p_id: id,
      p_error: error.slice(0, 500),
    });
    if (rpcError) throw rpcError;
  },

  async enqueue(job) {
    const { error } = await getServiceClient().from("sync_jobs").insert({
      job_type: job.jobType,
      store_external_id: job.storeExternalId,
      payload: job.payload,
      run_after: job.runAfter.toISOString(),
      dedupe_key: job.dedupeKey,
    });
    // The partial unique index rejects a duplicate of a pending or running job: that is the goal.
    if (error && error.code !== UNIQUE_VIOLATION) throw error;
  },

  async enqueueDailyReconciliation(day, now) {
    const { data, error } = await getServiceClient().rpc("enqueue_daily_reconciliation", {
      p_day: day,
      p_now: now.toISOString(),
    });
    if (error) throw error;
    return z.number().int().parse(data);
  },
};

export function createSupabaseRequestBudget(): RequestBudget {
  return {
    async reserve(storeExternalId: number, budget: CwBudget, now: Date) {
      const rule = BUDGET_RULES[budget];
      const { data, error } = await getServiceClient().rpc("reserve_cw_request", {
        p_store_external_id: storeExternalId,
        p_budget: budget,
        p_max_requests: rule.maxRequests,
        p_window_seconds: rule.windowSeconds,
        p_now: now.toISOString(),
      });
      if (error) throw error;
      return data === true;
    },
  };
}

const storeRowSchema = z.object({
  id: z.string().uuid(),
  environment: z.enum(["sandbox", "production"]),
  uninstalled_at: z.string().nullable(),
});

const accessRowSchema = z.object({
  allowed: z.boolean(),
  access_until: z.iso.datetime({ offset: true }).nullable(),
});

export const supabaseStoreRegistry: StoreRegistry = {
  async findByExternalId(externalId) {
    const client = getServiceClient();
    const { data, error } = await client
      .from("stores")
      .select("id, environment, uninstalled_at")
      .eq("external_id", externalId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const store = storeRowSchema.parse(data);
    const access = await client
      .from("store_access")
      .select("allowed, access_until")
      .eq("store_id", store.id)
      .maybeSingle();
    if (access.error) throw access.error;
    const accessRow = access.data === null ? null : accessRowSchema.parse(access.data);

    return {
      storeId: store.id,
      environment: store.environment,
      // access_until is checked here too: a store whose period ended makes no CW calls,
      // even before CW sends the event that blocks it.
      allowed:
        store.uninstalled_at === null &&
        isAccessAllowed(
          accessRow && {
            allowed: accessRow.allowed,
            accessUntil: accessRow.access_until === null ? null : new Date(accessRow.access_until),
          },
          new Date(),
        ),
    };
  },
};

export const supabaseOrderRepository: OrderRepository = {
  async saveSnapshot(storeExternalId: number, snapshot: OrderSnapshot) {
    const { error } = await getServiceClient().rpc("upsert_order_snapshot", {
      p_store_external_id: storeExternalId,
      p_order: {
        external_id: snapshot.externalId,
        customer_external_id: snapshot.customerExternalId,
        outcome: outcomeFromStatus(snapshot.status),
        status: snapshot.status,
        sales_channel: snapshot.salesChannel,
        total: fromCents(snapshot.totalCents),
        placed_at: snapshot.placedAt.toISOString(),
      },
      p_discounts: snapshot.discounts.map((discount) => ({
        category: discount.category,
        coupon_external_id: discount.couponExternalId,
        coupon_code: discount.couponCode,
        amount: fromCents(discount.amountCents),
        sponsor: discount.sponsor,
      })),
    });
    if (error) throw error;
  },
};
