import { describe, expect, it } from "vitest";
import {
  CwRateLimitedError,
  type CustomerSnapshot,
  type CwBudget,
  type CwCustomerSource,
  type CwOrderSource,
  type OrderSnapshot,
  type StoredCredentials,
  type SyncJob,
  type SyncJobRepository,
  type TokenRefresher,
} from "@/application/ports";
import {
  backoffSeconds,
  processSyncJob,
  SYNC_MAX_ATTEMPTS,
  type SyncDeps,
} from "./process-sync-job";

const NOW = new Date("2026-11-18T12:00:00Z");
const BUDGETS = {
  orderHistory: { maxRequests: 5, windowSeconds: 60 },
  orderDetails: { maxRequests: 300, windowSeconds: 180 },
} as const;

const snapshot: OrderSnapshot = {
  externalId: 90412,
  customerExternalId: 7,
  status: "closed",
  salesChannel: "catalog",
  totalCents: 4990,
  placedAt: NOW,
  discounts: [],
};

function harness(options: {
  store?: { allowed: boolean } | null;
  credentials?: StoredCredentials | null;
  lockHeld?: boolean;
  budgetFull?: boolean;
  source?: Partial<CwOrderSource>;
  customerSource?: Partial<CwCustomerSource>;
  refreshed?: StoredCredentials;
}) {
  const calls = {
    completed: [] as number[],
    failed: [] as { id: number; error: string }[],
    rescheduled: [] as { id: number; runAfter: Date; error: string; countsAsAttempt: boolean }[],
    enqueued: [] as { jobType: string; payload: unknown; dedupeKey: string }[],
    saved: [] as OrderSnapshot[],
    savedCustomers: [] as CustomerSnapshot[][],
    sourceCalls: [] as string[],
    refreshes: 0,
    reserved: [] as CwBudget[],
  };

  let stored: StoredCredentials | null =
    options.credentials === undefined
      ? {
          accessToken: "at-fresh",
          accessTokenExpiresAt: new Date(NOW.getTime() + 60 * 60_000),
          refreshToken: "rt",
          environment: "sandbox",
        }
      : options.credentials;

  const jobs: SyncJobRepository = {
    async claim() {
      return [];
    },
    async complete(id) {
      calls.completed.push(id);
    },
    async reschedule(id, runAfter, error, countsAsAttempt) {
      calls.rescheduled.push({ id, runAfter, error, countsAsAttempt });
    },
    async fail(id, error) {
      calls.failed.push({ id, error });
    },
    async enqueue(job) {
      calls.enqueued.push({ jobType: job.jobType, payload: job.payload, dedupeKey: job.dedupeKey });
    },
    async enqueueDailyReconciliation() {
      return 0;
    },
  };

  const source: CwOrderSource = {
    async fetchOrderDetails(_env, token, orderId) {
      calls.sourceCalls.push(`details:${orderId}:${token}`);
      if (options.source?.fetchOrderDetails)
        return options.source.fetchOrderDetails(_env, token, orderId);
      return snapshot;
    },
    async fetchHistoryPage(_env, token, query) {
      calls.sourceCalls.push(`history:${query.page}:${token}`);
      if (options.source?.fetchHistoryPage)
        return options.source.fetchHistoryPage(_env, token, query);
      return { orderIds: [], currentPage: 1, totalPages: 1 };
    },
  };

  const deps: SyncDeps = {
    jobs,
    stores: {
      async findByExternalId() {
        if (options.store === null) return null;
        const allowed = options.store?.allowed ?? true;
        return { storeId: "store-1", environment: "sandbox", allowed };
      },
    },
    credentials: {
      async acquireRefreshLock() {
        return !options.lockHeld;
      },
      async load() {
        return stored;
      },
      async saveRefreshedAndRelease() {
        stored = options.refreshed ?? stored;
      },
      async releaseRefreshLock() {},
    },
    refresher: {
      async refresh() {
        calls.refreshes += 1;
        return { accessToken: "at-new", refreshToken: "rt-new", expiresInSeconds: 7200 };
      },
    } satisfies TokenRefresher,
    budget: {
      async reserve(_ext, budget) {
        calls.reserved.push(budget);
        return !options.budgetFull;
      },
    },
    budgets: BUDGETS,
    orders: {
      async saveSnapshot(_ext, saved) {
        calls.saved.push(saved);
      },
    },
    source,
    customers: {
      async saveBatch(_ext, batch) {
        calls.savedCustomers.push([...batch]);
      },
    },
    customerSource: {
      async fetchCustomersPage(env, token, page) {
        calls.sourceCalls.push(`customers:${page}:${token}`);
        if (options.customerSource?.fetchCustomersPage) {
          return options.customerSource.fetchCustomersPage(env, token, page);
        }
        return { customers: [], currentPage: page, totalPages: page };
      },
    },
  };

  return { deps, calls };
}

function detailsJob(attempts = 1): SyncJob {
  return {
    id: 1,
    jobType: "fetch_order_details",
    storeExternalId: 123,
    payload: { orderId: 90412 },
    attempts,
  };
}

function first<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error("expected at least one item");
  return item;
}

describe("processSyncJob: order details", () => {
  it("fetches the order with a fresh token, stores it and completes the job", async () => {
    const { deps, calls } = harness({});
    await processSyncJob(detailsJob(), NOW, deps);
    expect(calls.reserved).toEqual(["orderDetails"]);
    expect(calls.sourceCalls).toEqual(["details:90412:at-fresh"]);
    expect(calls.saved).toEqual([snapshot]);
    expect(calls.completed).toEqual([1]);
  });

  it("makes no CW call for a store blocked by billing, and completes the job", async () => {
    const { deps, calls } = harness({ store: { allowed: false } });
    await processSyncJob(detailsJob(), NOW, deps);
    expect(calls.reserved).toHaveLength(0);
    expect(calls.sourceCalls).toHaveLength(0);
    expect(calls.completed).toEqual([1]);
  });

  it("fails the job when the store is unknown, without retrying", async () => {
    const { deps, calls } = harness({ store: null });
    await processSyncJob(detailsJob(), NOW, deps);
    expect(calls.failed).toEqual([{ id: 1, error: "unknown store" }]);
    expect(calls.rescheduled).toHaveLength(0);
  });

  it("waits for the window to open when the budget is full, without using an attempt", async () => {
    const { deps, calls } = harness({ budgetFull: true });
    await processSyncJob(detailsJob(), NOW, deps);
    expect(calls.sourceCalls).toHaveLength(0);
    expect(calls.rescheduled).toHaveLength(1);
    expect(first(calls.rescheduled).countsAsAttempt).toBe(false);
    expect(first(calls.rescheduled).runAfter.getTime()).toBe(NOW.getTime() + 181_000);
  });

  it("waits a minute when CW answers 429, without using an attempt", async () => {
    const { deps, calls } = harness({
      source: {
        async fetchOrderDetails() {
          throw new CwRateLimitedError();
        },
      },
    });
    await processSyncJob(detailsJob(), NOW, deps);
    expect(first(calls.rescheduled)).toMatchObject({ countsAsAttempt: false });
    expect(first(calls.rescheduled).runAfter.getTime()).toBe(NOW.getTime() + 60_000);
  });

  it("retries other errors with backoff, counting the attempt", async () => {
    const { deps, calls } = harness({
      source: {
        async fetchOrderDetails() {
          throw new Error("network down");
        },
      },
    });
    await processSyncJob(detailsJob(1), NOW, deps);
    expect(first(calls.rescheduled)).toMatchObject({
      countsAsAttempt: true,
      error: "network down",
    });
    expect(first(calls.rescheduled).runAfter.getTime()).toBe(NOW.getTime() + 60_000);
  });

  it("fails the job after the last attempt", async () => {
    const { deps, calls } = harness({
      source: {
        async fetchOrderDetails() {
          throw new Error("still down");
        },
      },
    });
    await processSyncJob(detailsJob(SYNC_MAX_ATTEMPTS), NOW, deps);
    expect(calls.failed).toEqual([{ id: 1, error: "still down" }]);
  });

  it("renews an expiring access token before calling CW", async () => {
    const { deps, calls } = harness({
      credentials: {
        accessToken: "at-old",
        accessTokenExpiresAt: new Date(NOW.getTime() + 60_000),
        refreshToken: "rt",
        environment: "sandbox",
      },
      refreshed: {
        accessToken: "at-new",
        accessTokenExpiresAt: new Date(NOW.getTime() + 7200_000),
        refreshToken: "rt-new",
        environment: "sandbox",
      },
    });
    await processSyncJob(detailsJob(), NOW, deps);
    expect(calls.refreshes).toBe(1);
    expect(calls.sourceCalls).toEqual(["details:90412:at-new"]);
  });

  it("waits instead of using a stale token while another worker refreshes it", async () => {
    const { deps, calls } = harness({
      lockHeld: true,
      credentials: {
        accessToken: "at-old",
        accessTokenExpiresAt: new Date(NOW.getTime() + 60_000),
        refreshToken: "rt",
        environment: "sandbox",
      },
    });
    await processSyncJob(detailsJob(), NOW, deps);
    expect(calls.sourceCalls).toHaveLength(0);
    expect(first(calls.rescheduled).countsAsAttempt).toBe(false);
  });
});

describe("processSyncJob: order history backfill", () => {
  const backfill = (page: number): SyncJob => ({
    id: 2,
    jobType: "backfill_order_history",
    storeExternalId: 123,
    payload: { startDate: "2026-11-17T00:00:00-03:00", endDate: "2026-11-17T23:59:59-03:00", page },
    attempts: 1,
  });

  it("queues a details fetch for every order on the page and the next page when there is one", async () => {
    const { deps, calls } = harness({
      source: {
        async fetchHistoryPage() {
          return { orderIds: [10, 11], currentPage: 1, totalPages: 3 };
        },
      },
    });
    await processSyncJob(backfill(1), NOW, deps);

    expect(calls.reserved).toEqual(["orderHistory"]);
    expect(
      calls.enqueued.filter((j) => j.jobType === "fetch_order_details").map((j) => j.dedupeKey),
    ).toEqual(["fetch:123:10", "fetch:123:11"]);
    const next = calls.enqueued.find((j) => j.jobType === "backfill_order_history");
    expect(next?.payload).toMatchObject({ page: 2 });
    expect(calls.completed).toEqual([2]);
  });

  it("does not queue another page after the last one", async () => {
    const { deps, calls } = harness({
      source: {
        async fetchHistoryPage() {
          return { orderIds: [], currentPage: 3, totalPages: 3 };
        },
      },
    });
    await processSyncJob(backfill(3), NOW, deps);
    expect(calls.enqueued.filter((j) => j.jobType === "backfill_order_history")).toHaveLength(0);
  });

  it("waits for the history window when the 5-per-minute budget is full", async () => {
    const { deps, calls } = harness({ budgetFull: true });
    await processSyncJob(backfill(1), NOW, deps);
    expect(calls.sourceCalls).toHaveLength(0);
    expect(first(calls.rescheduled).runAfter.getTime()).toBe(NOW.getTime() + 61_000);
  });

  it("turns a daily reconciliation into a backfill of that day", async () => {
    const { deps, calls } = harness({});
    await processSyncJob(
      {
        id: 3,
        jobType: "daily_reconciliation",
        storeExternalId: 123,
        payload: { day: "2026-11-17" },
        attempts: 1,
      },
      NOW,
      deps,
    );
    expect(calls.enqueued).toEqual([
      expect.objectContaining({
        jobType: "backfill_order_history",
        payload: {
          startDate: "2026-11-17T00:00:00-03:00",
          endDate: "2026-11-17T23:59:59-03:00",
          page: 1,
        },
      }),
    ]);
  });
});

describe("processSyncJob: customer sync", () => {
  const customerJob = (payload: unknown = { page: 1 }): SyncJob => ({
    id: 4,
    jobType: "sync_customers",
    storeExternalId: 123,
    payload,
    attempts: 1,
  });

  it("fetches a customer page, stores the batch and queues the next page", async () => {
    const sampleCustomer: CustomerSnapshot = {
      externalId: 77,
      name: "Ana",
      phone: "85999990000",
      allowsWhatsapp: true,
    };
    const { deps, calls } = harness({
      customerSource: {
        async fetchCustomersPage() {
          return { customers: [sampleCustomer], currentPage: 1, totalPages: 2 };
        },
      },
    });

    await processSyncJob(customerJob({}), NOW, deps);

    expect(calls.reserved).toEqual(["orderDetails"]);
    expect(calls.sourceCalls).toEqual(["customers:1:at-fresh"]);
    expect(calls.savedCustomers).toEqual([[sampleCustomer]]);
    expect(calls.enqueued).toEqual([
      {
        jobType: "sync_customers",
        payload: { page: 2 },
        dedupeKey: "customers:123:2",
      },
    ]);
    expect(calls.completed).toEqual([4]);
  });

  it("fails immediately when the customer page payload is invalid", async () => {
    const { deps, calls } = harness({});
    await processSyncJob(customerJob({ page: 0 }), NOW, deps);
    expect(calls.failed).toEqual([{ id: 4, error: "invalid customers payload" }]);
  });
});

describe("backoffSeconds", () => {
  it("doubles from one minute and caps at thirty minutes", () => {
    expect(backoffSeconds(1)).toBe(60);
    expect(backoffSeconds(2)).toBe(120);
    expect(backoffSeconds(3)).toBe(240);
    expect(backoffSeconds(20)).toBe(1800);
  });
});
