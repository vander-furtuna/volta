/**
 * Ports used by application use cases. Infrastructure (src/server) provides the adapters,
 * which keeps use cases testable with in-memory fakes.
 */

export interface StoredWebhookEvent {
  source: "cw_billing";
  eventId: string;
  eventType: string;
  storeExternalId: number | null;
  payload: unknown;
  receivedAt: Date;
}

export interface BillingEventStore {
  /** Persists the event once. Returns false when the event id was already stored (a retry). */
  saveIfNew(event: StoredWebhookEvent): Promise<boolean>;
}

export interface IncomingOrderEvent {
  eventId: string;
  eventType: "ORDER_CREATED" | "ORDER_STATUS_UPDATED";
  storeExternalId: number;
  orderId: number;
  /** Fields of the CW event only: no customer data is stored here. */
  payload: unknown;
  receivedAt: Date;
}

export interface OrderWebhookInbox {
  /**
   * Stores the event and schedules its details fetch as one unit: both happen or neither does.
   * Returns false when the event id was already stored (a CW retry), in which case nothing is
   * scheduled again. Errors propagate so the caller can ask CW to retry.
   */
  receive(event: IncomingOrderEvent): Promise<boolean>;
}

export type StoreEnvironment = "sandbox" | "production";

/** What CW says about the authorizing user and store, after the code is exchanged. */
export interface CwIdentity {
  storeExternalId: number;
  storeName: string;
  userExternalId: number;
  userName: string;
  userEmail: string | null;
  scopes: string[];
}

export interface CwTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface InstallationGateway {
  /** Exchanges the authorization code (PKCE) and reads the installation identity. */
  completeAuthorization(
    code: string,
    codeVerifier: string,
  ): Promise<{ tokens: CwTokens; identity: CwIdentity }>;
}

export interface StoreInstallationRepository {
  /**
   * Stores the store, its encrypted tokens, the user and the access row as one unit.
   * A re-installation updates the same store.
   */
  saveInstallation(input: {
    identity: CwIdentity;
    environment: StoreEnvironment;
    tokens: CwTokens;
    now: Date;
  }): Promise<{ storeId: string }>;
}

export interface StoredCredentials {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  environment: StoreEnvironment;
}

export interface StoreCredentialsRepository {
  /** Takes the per-store refresh lock if it is free or its lease expired. */
  acquireRefreshLock(storeId: string, now: Date, leaseSeconds: number): Promise<boolean>;
  /** Decrypted refresh token. Call only while holding the lock. */
  load(storeId: string): Promise<StoredCredentials | null>;
  /** Saves the tokens CW returned and releases the lock in the same write. */
  saveRefreshedAndRelease(storeId: string, tokens: CwTokens, now: Date): Promise<void>;
  /** Releases the lock without saving anything. */
  releaseRefreshLock(storeId: string): Promise<void>;
}

export interface TokenRefresher {
  /** Renews the access token. CW may or may not rotate the refresh token: keep the one returned. */
  refresh(environment: StoreEnvironment, refreshToken: string): Promise<CwTokens>;
}

/* ---------- Synchronization ---------- */

export type SyncJobType = "fetch_order_details" | "backfill_order_history" | "daily_reconciliation";

export interface SyncJob {
  id: number;
  jobType: SyncJobType;
  storeExternalId: number;
  payload: unknown;
  /** Attempts including the current one, counted when the job was claimed. */
  attempts: number;
}

export interface SyncJobRepository {
  /** Claims due jobs for this worker. Each job is returned to at most one worker at a time. */
  claim(limit: number, now: Date, leaseSeconds: number): Promise<SyncJob[]>;
  complete(id: number): Promise<void>;
  reschedule(id: number, runAfter: Date, error: string, countsAsAttempt: boolean): Promise<void>;
  fail(id: number, error: string): Promise<void>;
  /** Queues a job unless an identical one is already pending or running. */
  enqueue(job: {
    jobType: SyncJobType;
    storeExternalId: number;
    payload: unknown;
    runAfter: Date;
    dedupeKey: string;
  }): Promise<void>;
  /** Queues the daily reconciliation for each active store. Returns how many were queued. */
  enqueueDailyReconciliation(day: string, now: Date): Promise<number>;
}

export type CwBudget = "orderHistory" | "orderDetails";

export interface RequestBudget {
  /** Reserves one call in the store's budget. False when the window is full. */
  reserve(storeExternalId: number, budget: CwBudget, now: Date): Promise<boolean>;
}

export interface StoreRecord {
  storeId: string;
  environment: StoreEnvironment;
  /** False when billing has blocked the store. Blocked stores make no CW calls. */
  allowed: boolean;
}

export interface StoreRegistry {
  findByExternalId(externalId: number): Promise<StoreRecord | null>;
}

export interface OrderDiscount {
  category: "coupon" | "loyalty" | "other";
  couponExternalId: number | null;
  couponCode: string | null;
  amountCents: number;
  sponsor: "merchant" | "ifood";
}

/** An order as Volta stores it. Money is integer cents. */
export interface OrderSnapshot {
  externalId: number;
  customerExternalId: number | null;
  status: string;
  salesChannel: string;
  totalCents: number;
  placedAt: Date;
  discounts: OrderDiscount[];
}

export interface OrderRepository {
  /** Writes the order and replaces its discounts as one unit. */
  saveSnapshot(storeExternalId: number, snapshot: OrderSnapshot): Promise<void>;
}

/** Thrown by the CW adapter when CW answers 429. The job waits instead of failing. */
export class CwRateLimitedError extends Error {
  constructor() {
    super("CW rate limit reached");
    this.name = "CwRateLimitedError";
  }
}

export interface HistoryPageQuery {
  /** ISO 8601 with offset, for example 2026-11-18T00:00:00-03:00 */
  startDate: string;
  endDate: string;
  page: number;
}

export interface CwOrderSource {
  fetchOrderDetails(
    environment: StoreEnvironment,
    accessToken: string,
    orderId: number,
  ): Promise<OrderSnapshot>;
  fetchHistoryPage(
    environment: StoreEnvironment,
    accessToken: string,
    query: HistoryPageQuery,
  ): Promise<{ orderIds: number[]; currentPage: number; totalPages: number }>;
}
