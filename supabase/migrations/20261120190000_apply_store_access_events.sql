-- Applies CW access events (MARKETPLACE_APP_ACCESS_UPDATED) from the webhook inbox to store_access.
-- Source: https://docs.cardapioweb.com/cobranca/webhooks.md and cobranca/eventos.md
--
-- The access sequence is scoped to one CW installation, so store_access remembers which
-- installation its last sequence belongs to.
alter table store_access
  add column installation_external_id bigint,   -- CW installation_id of the last applied event
  add column last_event_occurred_at timestamptz; -- occurred_at of the last applied event

-- The worker reads pending billing events in arrival order.
create index webhook_events_pending_billing_idx
  on webhook_events (received_at)
  where source = 'cw_billing' and processed_at is null;

-- Applies one access snapshot, in one transaction, with the store_access row locked, so
-- overlapping workers cannot apply two snapshots out of order. Returns:
--   'applied'       the snapshot is now the store's access state
--   'stale'         an equal or newer snapshot was already applied; the event is only marked done
--   'store_unknown' the store is not installed yet; the event stays pending for a later run
--
-- Ordering rule:
--   * no snapshot applied yet: apply.
--   * same installation: apply only a greater sequence (gaps are normal; equal means a repeat).
--   * another installation (re-installation): sequences are not comparable, so the most recent
--     occurred_at wins. A late event from the previous installation never overrides the new one.
create or replace function apply_store_access_event(
  p_event_row_id bigint,
  p_store_external_id bigint,
  p_installation_external_id bigint,
  p_sequence bigint,
  p_occurred_at timestamptz,
  p_allowed boolean,
  p_reason text,
  p_access_until timestamptz,
  p_now timestamptz
) returns text
language plpgsql
set search_path = public
as $$
declare
  v_store_id uuid;
  v_access store_access%rowtype;
  v_result text;
begin
  select id into v_store_id from stores where external_id = p_store_external_id;
  if not found then
    -- CW may deliver access events before the OAuth installation finishes. Keep it pending.
    return 'store_unknown';
  end if;

  insert into store_access (store_id, allowed) values (v_store_id, false)
  on conflict (store_id) do nothing;

  select * into v_access from store_access where store_id = v_store_id for update;

  if v_access.last_event_sequence is null
     or v_access.last_event_occurred_at is null
     or (v_access.installation_external_id = p_installation_external_id
         and p_sequence > v_access.last_event_sequence)
     or (v_access.installation_external_id is distinct from p_installation_external_id
         and p_occurred_at > v_access.last_event_occurred_at)
  then
    update store_access set
      allowed = p_allowed,
      reason = p_reason,
      access_until = p_access_until,
      installation_external_id = p_installation_external_id,
      last_event_sequence = p_sequence,
      last_event_occurred_at = p_occurred_at,
      updated_at = p_now
    where store_id = v_store_id;
    v_result := 'applied';
  else
    v_result := 'stale';
  end if;

  update webhook_events set processed_at = p_now
  where id = p_event_row_id and processed_at is null;

  return v_result;
end;
$$;

revoke execute on function apply_store_access_event(bigint, bigint, bigint, bigint, timestamptz, boolean, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function apply_store_access_event(bigint, bigint, bigint, bigint, timestamptz, boolean, text, timestamptz, timestamptz)
  to service_role;
