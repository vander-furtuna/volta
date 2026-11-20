-- Calls the Volta sync cycle (GET <app url>/api/cron/sync) every minute from the database.
-- Vercel Hobby only runs cron jobs once a day, so the schedule lives in Supabase instead:
-- pg_cron triggers the job and pg_net makes the HTTP call.
-- Sources: https://supabase.com/docs/guides/cron/install.md
--          https://supabase.com/docs/guides/database/extensions/pg_net.md
--
-- The app URL and CRON_SECRET are NOT in this file. Store them once per project in Vault:
--   select vault.create_secret('https://<your-app>.vercel.app', 'volta_app_url');
--   select vault.create_secret('<same value as CRON_SECRET>', 'volta_cron_secret');
-- Until both secrets exist, each run does nothing. See docs/architecture/overview.md.

-- Sends one request to the sync route. Returns the pg_net request id, or null when the
-- secrets (or Vault itself, as in plain Postgres) are missing.
create or replace function request_sync_cycle()
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'volta_app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'volta_cron_secret';
  if v_url is null or v_secret is null or v_url = '' or v_secret = '' then
    raise notice 'Vault secrets volta_app_url and volta_cron_secret are not set: sync not requested';
    return null;
  end if;

  -- pg_net is asynchronous: the request leaves after this transaction commits. The timeout
  -- matches the route's maxDuration, so pg_net does not cancel a cycle that is still running.
  return net.http_get(
    url := rtrim(v_url, '/') || '/api/cron/sync',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 60000
  );
end;
$$;

-- Only the scheduler (the migration owner) runs it. Nobody calls it through the Data API.
revoke execute on function request_sync_cycle() from public, anon, authenticated, service_role;

-- Plain Postgres (CI, local tests) has no pg_cron or pg_net: the function is created, nothing
-- is scheduled. cron.schedule replaces a job with the same name, so this is safe to re-run.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron with schema pg_catalog;
    create schema if not exists extensions;
    create extension if not exists pg_net with schema extensions;
    perform cron.schedule('volta-sync-cycle', '* * * * *', 'select public.request_sync_cycle()');
  else
    raise notice 'pg_cron or pg_net is not available: volta-sync-cycle was not scheduled';
  end if;
end;
$$;
