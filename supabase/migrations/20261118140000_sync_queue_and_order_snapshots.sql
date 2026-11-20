-- Sync queue, per-store request budgets and atomic order snapshots.

-- Job bookkeeping. dedupe_key stops the same work from being queued twice while it is pending
-- or running. Finished jobs do not block a new one, so a later status change is still fetched.
alter table sync_jobs add column dedupe_key text;
alter table sync_jobs add column locked_until timestamptz;

create unique index sync_jobs_active_dedupe_idx
  on sync_jobs (dedupe_key)
  where dedupe_key is not null and status in ('pending', 'running');

-- One row per CW call that counts against a per-store budget.
create table cw_request_log (
  id bigint generated always as identity primary key,
  store_external_id bigint not null,
  budget text not null,
  requested_at timestamptz not null
);
create index cw_request_log_lookup_idx on cw_request_log (store_external_id, budget, requested_at);
alter table cw_request_log enable row level security;

-- Reserves one request in a budget, or returns false when the window is full.
-- The advisory lock serializes concurrent reservations for the same store and budget, so the
-- count and the insert cannot interleave.
create or replace function reserve_cw_request(
  p_store_external_id bigint,
  p_budget text,
  p_max_requests int,
  p_window_seconds int,
  p_now timestamptz
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_used int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_store_external_id::text || ':' || p_budget, 0));

  delete from cw_request_log
  where store_external_id = p_store_external_id
    and budget = p_budget
    and requested_at < p_now - make_interval(secs => p_window_seconds);

  select count(*) into v_used
  from cw_request_log
  where store_external_id = p_store_external_id
    and budget = p_budget
    and requested_at >= p_now - make_interval(secs => p_window_seconds);

  if v_used >= p_max_requests then
    return false;
  end if;

  insert into cw_request_log (store_external_id, budget, requested_at)
  values (p_store_external_id, p_budget, p_now);
  return true;
end;
$$;

-- Claims due jobs. SKIP LOCKED lets several workers run without taking the same job, and a job
-- whose lease expired (a worker that died) is claimed again.
create or replace function claim_sync_jobs(
  p_limit int,
  p_now timestamptz,
  p_lease_seconds int
) returns setof sync_jobs
language plpgsql
set search_path = public
as $$
begin
  return query
  update sync_jobs j
  set status = 'running',
      locked_until = p_now + make_interval(secs => p_lease_seconds),
      attempts = j.attempts + 1
  where j.id in (
    select s.id
    from sync_jobs s
    where (s.status = 'pending' and s.run_after <= p_now)
       or (s.status = 'running' and s.locked_until < p_now)
    order by s.run_after
    limit p_limit
    for update skip locked
  )
  returning j.*;
end;
$$;

create or replace function complete_sync_job(p_id bigint) returns void
language sql
set search_path = public
as $$
  update sync_jobs
  set status = 'done', locked_until = null, last_error = null
  where id = p_id;
$$;

-- Puts a job back in the queue. A rate-limit wait does not use up an attempt.
create or replace function reschedule_sync_job(
  p_id bigint,
  p_run_after timestamptz,
  p_error text,
  p_counts_as_attempt boolean
) returns void
language sql
set search_path = public
as $$
  update sync_jobs
  set status = 'pending',
      run_after = p_run_after,
      locked_until = null,
      last_error = p_error,
      attempts = case when p_counts_as_attempt then attempts else greatest(attempts - 1, 0) end
  where id = p_id;
$$;

create or replace function fail_sync_job(p_id bigint, p_error text) returns void
language sql
set search_path = public
as $$
  update sync_jobs
  set status = 'failed', locked_until = null, last_error = p_error
  where id = p_id;
$$;

-- Queues a daily reconciliation for every store that is installed and has access.
-- Idempotent per store and day: a day that already has a job (in any status) is skipped.
create or replace function enqueue_daily_reconciliation(p_day date, p_now timestamptz)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_count int;
begin
  insert into sync_jobs (job_type, store_external_id, payload, run_after, dedupe_key)
  select
    'daily_reconciliation',
    s.external_id,
    jsonb_build_object('day', p_day::text),
    p_now,
    'reconcile:' || s.external_id || ':' || p_day::text
  from stores s
  join store_access a on a.store_id = s.id
  where s.uninstalled_at is null
    and a.allowed
    and not exists (
      select 1 from sync_jobs j
      where j.job_type = 'daily_reconciliation'
        and j.store_external_id = s.external_id
        and j.payload->>'day' = p_day::text
    )
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Writes one order and its discounts as a unit. Discounts are replaced, so reprocessing an order
-- never duplicates them. Fails when the store is unknown.
create or replace function upsert_order_snapshot(
  p_store_external_id bigint,
  p_order jsonb,
  p_discounts jsonb
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_store_id uuid;
  v_order_id uuid;
begin
  select id into v_store_id from stores where external_id = p_store_external_id;
  if v_store_id is null then
    raise exception 'unknown store %', p_store_external_id;
  end if;

  insert into orders (
    store_id, external_id, customer_external_id, outcome, status,
    sales_channel, total, placed_at, synced_at
  )
  values (
    v_store_id,
    (p_order->>'external_id')::bigint,
    nullif(p_order->>'customer_external_id', '')::bigint,
    p_order->>'outcome',
    p_order->>'status',
    p_order->>'sales_channel',
    (p_order->>'total')::numeric(12, 2),
    (p_order->>'placed_at')::timestamptz,
    now()
  )
  on conflict (store_id, external_id) do update
    set customer_external_id = excluded.customer_external_id,
        outcome = excluded.outcome,
        status = excluded.status,
        sales_channel = excluded.sales_channel,
        total = excluded.total,
        placed_at = excluded.placed_at,
        synced_at = excluded.synced_at
  returning id into v_order_id;

  delete from order_discounts where order_id = v_order_id;

  insert into order_discounts (order_id, category, coupon_external_id, coupon_code, amount, sponsor)
  select
    v_order_id,
    d->>'category',
    nullif(d->>'coupon_external_id', '')::bigint,
    d->>'coupon_code',
    (d->>'amount')::numeric(12, 2),
    d->>'sponsor'
  from jsonb_array_elements(p_discounts) as d;

  return v_order_id;
end;
$$;

-- Receive path: store the webhook and queue its detail fetch, as before, but the job now carries
-- the event id in its dedupe key. A new event for an order that is still being fetched is queued
-- again instead of being silently dropped.
create or replace function receive_order_webhook(
  p_event_id text,
  p_event_type text,
  p_store_external_id bigint,
  p_order_id bigint,
  p_payload jsonb,
  p_received_at timestamptz
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_inserted int;
begin
  insert into webhook_events (source, event_id, event_type, store_external_id, payload, received_at)
  values ('cw_orders', p_event_id, p_event_type, p_store_external_id, p_payload, p_received_at)
  on conflict (source, event_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  insert into sync_jobs (job_type, store_external_id, payload, run_after, dedupe_key)
  values (
    'fetch_order_details',
    p_store_external_id,
    jsonb_build_object('orderId', p_order_id),
    p_received_at,
    'fetch:' || p_store_external_id || ':' || p_order_id || ':' || p_event_id
  )
  on conflict do nothing;

  return true;
end;
$$;

-- Server-only functions.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'reserve_cw_request(bigint, text, int, int, timestamptz)',
    'claim_sync_jobs(int, timestamptz, int)',
    'complete_sync_job(bigint)',
    'reschedule_sync_job(bigint, timestamptz, text, boolean)',
    'fail_sync_job(bigint, text)',
    'enqueue_daily_reconciliation(date, timestamptz)',
    'upsert_order_snapshot(bigint, jsonb, jsonb)',
    'receive_order_webhook(text, text, bigint, bigint, jsonb, timestamptz)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
