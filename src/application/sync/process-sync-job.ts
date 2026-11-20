import {
  CwRateLimitedError,
  type CustomerRepository,
  type CwBudget,
  type CwCustomerSource,
  type CwOrderSource,
  type OrderRepository,
  type RequestBudget,
  type StoreCredentialsRepository,
  type StoreRegistry,
  type StoreRecord,
  type SyncJob,
  type SyncJobRepository,
  type TokenRefresher,
} from "@/application/ports";
import { refreshStoreToken } from "@/application/credentials/refresh-store-token";

export const SYNC_MAX_ATTEMPTS = 8;
/** Renew the access token when less than this remains. */
const TOKEN_MARGIN_MS = 5 * 60_000;
const RATE_LIMIT_WAIT_SECONDS = 60;

export interface BudgetRule {
  maxRequests: number;
  windowSeconds: number;
}

export interface SyncDeps {
  jobs: SyncJobRepository;
  stores: StoreRegistry;
  credentials: StoreCredentialsRepository;
  refresher: TokenRefresher;
  budget: RequestBudget;
  budgets: Record<CwBudget, BudgetRule>;
  orders: OrderRepository;
  source: CwOrderSource;
  customers?: CustomerRepository;
  customerSource?: CwCustomerSource;
}

/** The job must wait until `runAfter`. Not a failure. */
class DeferJob extends Error {
  constructor(
    readonly runAfter: Date,
    readonly countsAsAttempt: boolean,
    reason: string,
  ) {
    super(reason);
    this.name = "DeferJob";
  }
}

/** The job cannot succeed as written (unknown store, bad payload). Retrying would not help. */
class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}

/** Exponential backoff for failed attempts: 1, 2, 4 … minutes, capped at 30 minutes. */
export function backoffSeconds(attempts: number): number {
  return Math.min(60 * 2 ** Math.max(attempts - 1, 0), 30 * 60);
}

/**
 * Runs one claimed job and records the outcome: complete, wait, retry with backoff, or fail.
 * Store blocks and budget limits are checked before every CW call.
 */
export async function processSyncJob(job: SyncJob, now: Date, deps: SyncDeps): Promise<void> {
  try {
    await runJob(job, now, deps);
    await deps.jobs.complete(job.id);
  } catch (error) {
    await recordFailure(job, now, error, deps.jobs);
  }
}

async function recordFailure(
  job: SyncJob,
  now: Date,
  error: unknown,
  jobs: SyncJobRepository,
): Promise<void> {
  const message = error instanceof Error ? error.message : "unknown error";

  if (error instanceof DeferJob) {
    await jobs.reschedule(job.id, error.runAfter, message, error.countsAsAttempt);
    return;
  }
  if (error instanceof CwRateLimitedError) {
    const runAfter = new Date(now.getTime() + RATE_LIMIT_WAIT_SECONDS * 1000);
    await jobs.reschedule(job.id, runAfter, message, false);
    return;
  }
  if (error instanceof PermanentJobError || job.attempts >= SYNC_MAX_ATTEMPTS) {
    await jobs.fail(job.id, message);
    return;
  }
  const runAfter = new Date(now.getTime() + backoffSeconds(job.attempts) * 1000);
  await jobs.reschedule(job.id, runAfter, message, true);
}

async function runJob(job: SyncJob, now: Date, deps: SyncDeps): Promise<void> {
  const store = await deps.stores.findByExternalId(job.storeExternalId);
  if (!store) throw new PermanentJobError("unknown store");
  if (!store.allowed) return; // blocked by billing: complete without touching CW

  switch (job.jobType) {
    case "fetch_order_details":
      return fetchOrderDetails(job, store, now, deps);
    case "backfill_order_history":
      return backfillHistoryPage(job, store, now, deps);
    case "sync_customers":
      return syncCustomersPage(job, store, now, deps);
    case "daily_reconciliation":
      return reconcileDay(job, now, deps);
    default:
      throw new PermanentJobError("unknown job type");
  }
}

async function syncCustomersPage(
  job: SyncJob,
  store: StoreRecord,
  now: Date,
  deps: SyncDeps,
): Promise<void> {
  if (!deps.customerSource || !deps.customers) {
    throw new PermanentJobError("customer sync is not configured");
  }
  const page = readCustomersPage(job.payload);
  await reserveOrDefer(job.storeExternalId, "orderDetails", now, deps);
  const accessToken = await accessTokenFor(store, now, deps);

  const result = await deps.customerSource.fetchCustomersPage(store.environment, accessToken, page);
  if (result.customers.length > 0) {
    await deps.customers.saveBatch(job.storeExternalId, result.customers);
  }
  if (result.currentPage < result.totalPages) {
    const nextPage = result.currentPage + 1;
    await deps.jobs.enqueue({
      jobType: "sync_customers",
      storeExternalId: job.storeExternalId,
      payload: { page: nextPage },
      runAfter: now,
      dedupeKey: `customers:${job.storeExternalId}:${nextPage}`,
    });
  }
}

async function fetchOrderDetails(
  job: SyncJob,
  store: StoreRecord,
  now: Date,
  deps: SyncDeps,
): Promise<void> {
  const orderId = readPayloadNumber(job.payload, "orderId");
  await reserveOrDefer(job.storeExternalId, "orderDetails", now, deps);
  const accessToken = await accessTokenFor(store, now, deps);

  const snapshot = await deps.source.fetchOrderDetails(store.environment, accessToken, orderId);
  await deps.orders.saveSnapshot(job.storeExternalId, snapshot);
}

async function backfillHistoryPage(
  job: SyncJob,
  store: StoreRecord,
  now: Date,
  deps: SyncDeps,
): Promise<void> {
  const query = readHistoryQuery(job.payload);
  await reserveOrDefer(job.storeExternalId, "orderHistory", now, deps);
  const accessToken = await accessTokenFor(store, now, deps);

  const page = await deps.source.fetchHistoryPage(store.environment, accessToken, query);

  for (const orderId of page.orderIds) {
    await deps.jobs.enqueue({
      jobType: "fetch_order_details",
      storeExternalId: job.storeExternalId,
      payload: { orderId },
      runAfter: now,
      dedupeKey: `fetch:${job.storeExternalId}:${orderId}`,
    });
  }

  if (page.currentPage < page.totalPages) {
    const next = { ...query, page: page.currentPage + 1 };
    await deps.jobs.enqueue({
      jobType: "backfill_order_history",
      storeExternalId: job.storeExternalId,
      payload: next,
      runAfter: now,
      dedupeKey: historyDedupeKey(job.storeExternalId, next),
    });
  }
}

async function reconcileDay(job: SyncJob, now: Date, deps: SyncDeps): Promise<void> {
  const day = readPayloadString(job.payload, "day");
  const query: HistoryQueryPayload = {
    startDate: `${day}T00:00:00-03:00`,
    endDate: `${day}T23:59:59-03:00`,
    page: 1,
  };
  await deps.jobs.enqueue({
    jobType: "backfill_order_history",
    storeExternalId: job.storeExternalId,
    payload: query,
    runAfter: now,
    dedupeKey: historyDedupeKey(job.storeExternalId, query),
  });
}

async function reserveOrDefer(
  storeExternalId: number,
  budget: CwBudget,
  now: Date,
  deps: SyncDeps,
): Promise<void> {
  const allowed = await deps.budget.reserve(storeExternalId, budget, now);
  if (allowed) return;
  const { windowSeconds } = deps.budgets[budget];
  throw new DeferJob(
    new Date(now.getTime() + (windowSeconds + 1) * 1000),
    false,
    `${budget} budget is full`,
  );
}

/**
 * Returns a usable access token. Renews it first when it is close to expiring. If another worker
 * is renewing it, the job waits instead of sending a stale token.
 */
async function accessTokenFor(store: StoreRecord, now: Date, deps: SyncDeps): Promise<string> {
  const current = await deps.credentials.load(store.storeId);
  if (!current) throw new PermanentJobError("store has no credentials");

  if (current.accessTokenExpiresAt.getTime() - now.getTime() > TOKEN_MARGIN_MS) {
    return current.accessToken;
  }

  const outcome = await refreshStoreToken(
    { storeId: store.storeId, now },
    { credentials: deps.credentials, refresher: deps.refresher },
  );
  if (outcome.status === "busy") {
    throw new DeferJob(new Date(now.getTime() + 60_000), false, "token refresh in progress");
  }
  if (outcome.status === "no_credentials") {
    throw new PermanentJobError("store has no credentials");
  }

  const renewed = await deps.credentials.load(store.storeId);
  if (!renewed) throw new PermanentJobError("store has no credentials");
  return renewed.accessToken;
}

/* ---------- payload helpers ---------- */

interface HistoryQueryPayload {
  startDate: string;
  endDate: string;
  page: number;
}

function historyDedupeKey(storeExternalId: number, query: HistoryQueryPayload): string {
  return `backfill:${storeExternalId}:${query.startDate}:${query.endDate}:${query.page}`;
}

function readPayloadNumber(payload: unknown, key: string): number {
  const value = (payload as Record<string, unknown> | null)?.[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new PermanentJobError(`payload.${key} must be an integer`);
  }
  return value;
}

function readPayloadString(payload: unknown, key: string): string {
  const value = (payload as Record<string, unknown> | null)?.[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new PermanentJobError(`payload.${key} must be a string`);
  }
  return value;
}

function readHistoryQuery(payload: unknown): HistoryQueryPayload {
  const record = payload as Record<string, unknown> | null;
  const page = record?.page;
  if (
    typeof record?.startDate !== "string" ||
    typeof record?.endDate !== "string" ||
    typeof page !== "number" ||
    !Number.isSafeInteger(page) ||
    page < 1
  ) {
    throw new PermanentJobError("invalid history payload");
  }
  return { startDate: record.startDate, endDate: record.endDate, page };
}

function readCustomersPage(payload: unknown): number {
  const record = payload as Record<string, unknown> | null;
  if (!record || record.page === undefined) return 1;
  const page = record.page;
  if (typeof page !== "number" || !Number.isSafeInteger(page) || page < 1) {
    throw new PermanentJobError("invalid customers payload");
  }
  return page;
}
