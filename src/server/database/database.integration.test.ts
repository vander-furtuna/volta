/**
 * Database integration tests. They exercise the SQL functions and constraints against a real
 * Postgres. Run them with `pnpm test:db` after pointing VOLTA_TEST_DATABASE_URL at a database
 * where the migrations in supabase/migrations are applied. They are skipped otherwise.
 *
 * The PostgREST layer of Supabase is not part of these tests: they call the functions directly.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";

const url = process.env.VOLTA_TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

const NOW = new Date("2026-11-18T12:00:00Z");
const iso = (d: Date) => d.toISOString();

describeDb("database functions", () => {
  const pool = new Pool({ connectionString: url, max: 10 });

  afterAll(async () => {
    await pool.end();
  });

  async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    const result = await pool.query(sql, params);
    return result.rows as T[];
  }

  beforeEach(async () => {
    await q(
      "truncate table stores, webhook_events, sync_jobs, cw_request_log restart identity cascade",
    );
  });

  async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
    const rows = await q<T>(sql, params);
    const row = rows[0];
    if (row === undefined) throw new Error("expected one row");
    return row;
  }

  async function installStore(externalId: number, name = "Loja", allowed = true) {
    const row = await one<{ id: string }>(
      `select upsert_store_installation($1, $2, 'sandbox', 9, 'Maria', null,
         'enc-access', 'enc-refresh', $3, array['auth','orders'], $4) as id`,
      [externalId, name, iso(new Date(NOW.getTime() + 7200_000)), iso(NOW)],
    );
    if (allowed) {
      await q("update store_access set allowed = true where store_id = $1", [row.id]);
    }
    return row.id;
  }

  describe("record_campaign_coupon", () => {
    it("records one event and refuses updates from another store or user", async () => {
      const storeId = await installStore(123);
      const otherStoreId = await installStore(456);
      const { id: userId } = await one<{ id: string }>("select id from users where store_id = $1", [
        storeId,
      ]);
      const { id } = await one<{ id: string }>(
        "insert into campaigns (store_id, name, status, audience_criteria) values ($1, 'Recompra', 'audience_frozen', '{}') returning id",
        [storeId],
      );
      const record = (actorStoreId: string, actorUserId: string) =>
        one<{ confirmed: boolean }>(
          "select record_campaign_coupon($1, $2, $3, 'audience_frozen', 'coupon_created', 'coupon_created', 99) as confirmed",
          [actorStoreId, id, actorUserId],
        );
      expect((await record(otherStoreId, userId)).confirmed).toBe(false);
      const { id: otherUserId } = await one<{ id: string }>(
        "select id from users where store_id = $1",
        [otherStoreId],
      );
      expect((await record(storeId, otherUserId)).confirmed).toBe(false);
      expect((await record(storeId, userId)).confirmed).toBe(true);
      expect((await record(storeId, userId)).confirmed).toBe(true);
      expect(
        await q("select event_type from campaign_events where campaign_id = $1", [id]),
      ).toEqual([{ event_type: "coupon_created" }]);
    });
  });

  describe("receive_order_webhook", () => {
    const args = (eventId: string, orderId = 90412) =>
      [
        eventId,
        "ORDER_CREATED",
        123,
        orderId,
        JSON.stringify({ event_id: eventId }),
        iso(NOW),
      ] as const;

    it("stores the event and queues one fetch, and a CW retry adds nothing", async () => {
      const first = await one<{ receive_order_webhook: boolean }>(
        "select receive_order_webhook($1, $2, $3, $4, $5::jsonb, $6)",
        [...args("evt_1")],
      );
      const retry = await one<{ receive_order_webhook: boolean }>(
        "select receive_order_webhook($1, $2, $3, $4, $5::jsonb, $6)",
        [...args("evt_1")],
      );
      expect(first.receive_order_webhook).toBe(true);
      expect(retry.receive_order_webhook).toBe(false);

      const jobs = await q("select job_type from sync_jobs");
      expect(jobs).toHaveLength(1);
    });

    it("queues a new event for an order that already has a fetch in progress", async () => {
      await q("select receive_order_webhook($1, $2, $3, $4, $5::jsonb, $6)", [...args("evt_1")]);
      await q("select receive_order_webhook($1, $2, $3, $4, $5::jsonb, $6)", [...args("evt_2")]);
      const jobs = await q("select dedupe_key from sync_jobs order by id");
      expect(jobs).toHaveLength(2);
    });

    it("cannot be called by the browser roles", async () => {
      const client: PoolClient = await pool.connect();
      try {
        await client.query("set role anon");
        await expect(
          client.query("select receive_order_webhook($1, $2, $3, $4, $5::jsonb, $6)", [
            ...args("evt_9"),
          ]),
        ).rejects.toMatchObject({ code: "42501" });
      } finally {
        await client.query("reset role");
        client.release();
      }
    });
  });

  describe("reserve_cw_request", () => {
    const reserve = (now: Date) =>
      q<{ reserve_cw_request: boolean }>(
        "select reserve_cw_request(123, 'orderHistory', 5, 60, $1)",
        [iso(now)],
      ).then((rows) => rows[0]?.reserve_cw_request === true);

    it("allows five calls in a window and refuses the sixth", async () => {
      const results: boolean[] = [];
      for (let i = 0; i < 6; i++) results.push(await reserve(NOW));
      expect(results).toEqual([true, true, true, true, true, false]);
    });

    it("opens again once the window has passed", async () => {
      for (let i = 0; i < 5; i++) await reserve(NOW);
      expect(await reserve(new Date(NOW.getTime() + 61_000))).toBe(true);
    });

    it("never lets concurrent callers exceed the budget", async () => {
      const results = await Promise.all(Array.from({ length: 12 }, () => reserve(NOW)));
      expect(results.filter(Boolean)).toHaveLength(5);
    });
  });

  describe("claim_sync_jobs", () => {
    async function queueJob(runAfter: Date, key: string | null = null) {
      await q(
        `insert into sync_jobs (job_type, store_external_id, payload, run_after, dedupe_key)
         values ('fetch_order_details', 123, '{"orderId": 1}', $1, $2)`,
        [iso(runAfter), key],
      );
    }

    it("hands each pending job to exactly one of two concurrent workers", async () => {
      await queueJob(NOW, "a");
      await queueJob(NOW, "b");
      const [one, two] = await Promise.all([
        q("select * from claim_sync_jobs(1, $1, 300)", [iso(NOW)]),
        q("select * from claim_sync_jobs(1, $1, 300)", [iso(NOW)]),
      ]);
      expect(one).toHaveLength(1);
      expect(two).toHaveLength(1);
      expect(one[0]).not.toEqual(two[0]);
    });

    it("skips jobs scheduled for later", async () => {
      await queueJob(new Date(NOW.getTime() + 60_000));
      expect(await q("select * from claim_sync_jobs(10, $1, 300)", [iso(NOW)])).toHaveLength(0);
    });

    it("reclaims a job whose worker died and whose lease expired", async () => {
      await q(
        `insert into sync_jobs (job_type, store_external_id, payload, status, locked_until)
         values ('fetch_order_details', 123, '{"orderId": 1}', 'running', $1)`,
        [iso(new Date(NOW.getTime() - 3600_000))],
      );
      expect(await q("select * from claim_sync_jobs(10, $1, 300)", [iso(NOW)])).toHaveLength(1);
    });

    it("rejects a second pending job with the same dedupe key", async () => {
      await queueJob(NOW, "same");
      await expect(queueJob(NOW, "same")).rejects.toMatchObject({ code: "23505" });
    });

    it("lets the same key be queued again once the earlier job is done", async () => {
      await queueJob(NOW, "again");
      const job = await one<{ id: string }>("select id from sync_jobs");
      await q("select complete_sync_job($1)", [job.id]);
      await expect(queueJob(NOW, "again")).resolves.toBeUndefined();
    });

    it("gives back the attempt when a job waits for a budget", async () => {
      await queueJob(NOW);
      const claimed = await one<{ id: string; attempts: number }>(
        "select * from claim_sync_jobs(1, $1, 300)",
        [iso(NOW)],
      );
      expect(claimed.attempts).toBe(1);
      await q("select reschedule_sync_job($1, $2, 'wait', false)", [claimed.id, iso(NOW)]);
      const after = await one<{ attempts: number; status: string }>(
        "select attempts, status from sync_jobs where id = $1",
        [claimed.id],
      );
      expect(after).toMatchObject({ attempts: 0, status: "pending" });
    });
  });

  describe("refresh lock", () => {
    it("lets only one of many concurrent callers take the lock", async () => {
      const storeId = await installStore(123);
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          q<{ acquire_store_refresh_lock: boolean }>(
            "select acquire_store_refresh_lock($1, $2, 120)",
            [storeId, iso(NOW)],
          ).then((rows) => rows[0]?.acquire_store_refresh_lock === true),
        ),
      );
      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it("takes over an expired lease, and saving tokens releases the lock", async () => {
      const storeId = await installStore(123);
      await q("select acquire_store_refresh_lock($1, $2, 120)", [storeId, iso(NOW)]);
      const later = new Date(NOW.getTime() + 300_000);
      const again = await one<{ acquire_store_refresh_lock: boolean }>(
        "select acquire_store_refresh_lock($1, $2, 120)",
        [storeId, iso(later)],
      );
      expect(again.acquire_store_refresh_lock).toBe(true);

      await q("select save_store_tokens_and_release_lock($1, 'enc-a2', 'enc-r2', $2, $3)", [
        storeId,
        iso(new Date(later.getTime() + 7200_000)),
        iso(later),
      ]);
      const row = await one<{ refreshing_since: Date | null; refresh_token_encrypted: string }>(
        "select refreshing_since, refresh_token_encrypted from store_credentials where store_id = $1",
        [storeId],
      );
      expect(row.refreshing_since).toBeNull();
      expect(row.refresh_token_encrypted).toBe("enc-r2");
    });

    it("refuses to save tokens for a store without credentials", async () => {
      await expect(
        q("select save_store_tokens_and_release_lock(gen_random_uuid(), 'a', 'r', $1, $1)", [
          iso(NOW),
        ]),
      ).rejects.toThrow(/not found/);
    });
  });

  describe("upsert_store_installation", () => {
    it("is idempotent: a reinstall updates the same store and keeps one user", async () => {
      const first = await installStore(123, "Loja A");
      const second = await installStore(123, "Loja A renomeada");
      expect(second).toBe(first);

      const store = await one<{ name: string; count: number }>(
        `select s.name, (select count(*)::int from users u where u.store_id = s.id) as count
         from stores s where s.id = $1`,
        [first],
      );
      expect(store).toEqual({ name: "Loja A renomeada", count: 1 });
    });

    it("starts with access blocked until billing grants it", async () => {
      const storeId = await installStore(123, "Loja", false);
      const access = await one<{ allowed: boolean }>(
        "select allowed from store_access where store_id = $1",
        [storeId],
      );
      expect(access.allowed).toBe(false);
    });
  });

  describe("upsert_order_snapshot", () => {
    const order = (status: string) => ({
      external_id: 90412,
      customer_external_id: 7,
      outcome: status === "closed" ? "completed" : "open",
      status,
      sales_channel: "catalog",
      total: 49.9,
      placed_at: iso(NOW),
    });
    const discount = (amount: number) => ({
      category: "coupon",
      coupon_external_id: 55,
      coupon_code: "VOLTA5",
      amount,
      sponsor: "merchant",
    });

    it("writes the order and its discounts, and replaces discounts on reprocessing", async () => {
      await installStore(123);
      await q("select upsert_order_snapshot(123, $1::jsonb, $2::jsonb)", [
        JSON.stringify(order("confirmed")),
        JSON.stringify([discount(5), discount(2)]),
      ]);
      await q("select upsert_order_snapshot(123, $1::jsonb, $2::jsonb)", [
        JSON.stringify(order("closed")),
        JSON.stringify([discount(5)]),
      ]);

      const orders = await q<{ status: string; outcome: string; total: string }>(
        "select status, outcome, total from orders",
      );
      expect(orders).toHaveLength(1);
      expect(orders[0]).toMatchObject({ status: "closed", outcome: "completed" });
      expect(Number(orders[0]?.total)).toBe(49.9);

      const discounts = await q("select amount from order_discounts");
      expect(discounts).toHaveLength(1);
    });

    it("refuses an order for a store that does not exist", async () => {
      await expect(
        q("select upsert_order_snapshot(999, $1::jsonb, '[]'::jsonb)", [
          JSON.stringify(order("closed")),
        ]),
      ).rejects.toThrow(/unknown store/);
    });
  });

  describe("enqueue_daily_reconciliation", () => {
    it("queues one reconciliation per active store per day only", async () => {
      await installStore(1, "Ativa", true);
      await installStore(2, "Sem acesso", false);
      const uninstalled = await installStore(3, "Desinstalada", true);
      await q("update stores set uninstalled_at = now() where id = $1", [uninstalled]);

      const day = "2026-11-17";
      const first = await one<{ enqueue_daily_reconciliation: number }>(
        "select enqueue_daily_reconciliation($1, $2)",
        [day, iso(NOW)],
      );
      const second = await one<{ enqueue_daily_reconciliation: number }>(
        "select enqueue_daily_reconciliation($1, $2)",
        [day, iso(NOW)],
      );
      expect(first.enqueue_daily_reconciliation).toBe(1);
      expect(second.enqueue_daily_reconciliation).toBe(0);
    });
  });
});
