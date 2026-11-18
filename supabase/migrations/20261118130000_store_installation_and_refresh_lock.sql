-- Store installation and the per-store refresh lock.
-- Each function runs in one transaction, so a failure leaves no half-written installation and
-- no stale lock. Tokens arrive already encrypted: the server encrypts them before the call.

-- Installs or re-installs a store. Writes the store, its encrypted tokens, the user account and
-- the access row together. Access starts blocked: CW billing grants it (MARKETPLACE_APP_ACCESS_UPDATED).
create or replace function upsert_store_installation(
  p_external_id bigint,
  p_name text,
  p_environment text,
  p_user_external_id bigint,
  p_user_name text,
  p_user_email text,
  p_access_token_encrypted text,
  p_refresh_token_encrypted text,
  p_access_token_expires_at timestamptz,
  p_scopes text[],
  p_now timestamptz
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_store_id uuid;
begin
  insert into stores (external_id, name, environment, installed_at, uninstalled_at)
  values (p_external_id, p_name, p_environment, p_now, null)
  on conflict (external_id) do update
    set name = excluded.name,
        environment = excluded.environment,
        uninstalled_at = null
  returning id into v_store_id;

  insert into store_credentials (
    store_id, access_token_encrypted, refresh_token_encrypted,
    access_token_expires_at, scopes, refreshing_since, updated_at
  )
  values (
    v_store_id, p_access_token_encrypted, p_refresh_token_encrypted,
    p_access_token_expires_at, p_scopes, null, p_now
  )
  on conflict (store_id) do update
    set access_token_encrypted = excluded.access_token_encrypted,
        refresh_token_encrypted = excluded.refresh_token_encrypted,
        access_token_expires_at = excluded.access_token_expires_at,
        scopes = excluded.scopes,
        refreshing_since = null,
        updated_at = excluded.updated_at;

  insert into store_access (store_id, allowed)
  values (v_store_id, false)
  on conflict (store_id) do nothing;

  insert into users (store_id, external_id, name, email)
  values (v_store_id, p_user_external_id, p_user_name, p_user_email)
  on conflict (store_id, external_id) do update
    set name = excluded.name,
        email = excluded.email;

  return v_store_id;
end;
$$;

-- Takes the refresh lock if it is free or its lease has expired. One statement, so two workers
-- cannot both win. Returns false when another worker holds a live lease.
create or replace function acquire_store_refresh_lock(
  p_store_id uuid,
  p_now timestamptz,
  p_lease_seconds int
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_rows int;
begin
  update store_credentials
  set refreshing_since = p_now
  where store_id = p_store_id
    and (refreshing_since is null or refreshing_since < p_now - make_interval(secs => p_lease_seconds));

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

-- Releases the lock without saving anything (used when the refresh call failed).
create or replace function release_store_refresh_lock(p_store_id uuid)
returns void
language sql
set search_path = public
as $$
  update store_credentials set refreshing_since = null where store_id = p_store_id;
$$;

-- Saves the tokens CW returned and releases the lock in the same write.
create or replace function save_store_tokens_and_release_lock(
  p_store_id uuid,
  p_access_token_encrypted text,
  p_refresh_token_encrypted text,
  p_access_token_expires_at timestamptz,
  p_now timestamptz
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_rows int;
begin
  update store_credentials
  set access_token_encrypted = p_access_token_encrypted,
      refresh_token_encrypted = p_refresh_token_encrypted,
      access_token_expires_at = p_access_token_expires_at,
      refreshing_since = null,
      updated_at = p_now
  where store_id = p_store_id;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'store_credentials not found for store %', p_store_id;
  end if;
end;
$$;

-- Only the server (service role) may call these functions.
revoke execute on function upsert_store_installation(bigint, text, text, bigint, text, text, text, text, timestamptz, text[], timestamptz)
  from public, anon, authenticated;
revoke execute on function acquire_store_refresh_lock(uuid, timestamptz, int) from public, anon, authenticated;
revoke execute on function release_store_refresh_lock(uuid) from public, anon, authenticated;
revoke execute on function save_store_tokens_and_release_lock(uuid, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;

grant execute on function upsert_store_installation(bigint, text, text, bigint, text, text, text, text, timestamptz, text[], timestamptz)
  to service_role;
grant execute on function acquire_store_refresh_lock(uuid, timestamptz, int) to service_role;
grant execute on function release_store_refresh_lock(uuid) to service_role;
grant execute on function save_store_tokens_and_release_lock(uuid, text, text, timestamptz, timestamptz)
  to service_role;
