-- Atomic intake of a CW order webhook.
-- Stores the event and schedules its details fetch in one transaction, so a failure in either
-- write rolls both back. CW retries the event, and without this a job could be lost between
-- the two writes: the retry would hit the dedupe and never schedule the fetch.
--
-- Returns false when the event id was already stored (a CW retry). The caller must answer 200.

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

  insert into sync_jobs (job_type, store_external_id, payload)
  values ('fetch_order_details', p_store_external_id, jsonb_build_object('orderId', p_order_id));

  return true;
end;
$$;

-- Only the server (service role) may call it. The browser never reaches the database.
revoke execute on function receive_order_webhook(text, text, bigint, bigint, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function receive_order_webhook(text, text, bigint, bigint, jsonb, timestamptz)
  to service_role;
