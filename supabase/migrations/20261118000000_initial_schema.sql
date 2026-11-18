-- Volta initial schema.
-- Every table carries store_id. RLS is enabled with no policies: only the server
-- (service role) reads and writes. The browser never talks to the database directly.

create extension if not exists pgcrypto;

-- One row per CW installation (one store unit).
create table stores (
  id uuid primary key default gen_random_uuid(),
  external_id bigint not null unique,           -- CW company.id / merchant_id
  name text not null,
  environment text not null check (environment in ('sandbox', 'production')),
  installed_at timestamptz not null default now(),
  uninstalled_at timestamptz,
  created_at timestamptz not null default now()
);

-- Encrypted CW tokens (AES-256-GCM, see src/server/security/token-encryption.ts).
create table store_credentials (
  store_id uuid primary key references stores (id) on delete cascade,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  access_token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  refreshing_since timestamptz,                 -- lock: one refresh per store at a time
  updated_at timestamptz not null default now()
);

-- Access granted by CW billing (MARKETPLACE_APP_ACCESS_UPDATED). Checked on every protected call.
create table store_access (
  store_id uuid primary key references stores (id) on delete cascade,
  allowed boolean not null default false,
  access_until timestamptz,                     -- exclusive limit; null = no time limit
  reason text,
  plan_id text,
  last_event_sequence bigint,
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  external_id bigint not null,                  -- CW user.id
  name text not null,
  email text,
  created_at timestamptz not null default now(),
  unique (store_id, external_id)
);

-- Only the fields Volta needs (LGPD data minimization).
create table customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  external_id bigint not null,                  -- CW customer.id
  name text not null,
  phone text,
  allows_whatsapp boolean not null default true, -- CW notifications_enabled
  synced_at timestamptz not null default now(),
  unique (store_id, external_id)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  external_id bigint not null,                  -- CW order id
  customer_external_id bigint,                  -- null when the order has no identified customer
  outcome text not null check (outcome in ('completed', 'canceled', 'open')),
  status text not null,                         -- raw CW status
  sales_channel text not null,
  total numeric(12, 2) not null,
  placed_at timestamptz not null,
  synced_at timestamptz not null default now(),
  unique (store_id, external_id)
);
create index orders_store_customer_idx on orders (store_id, customer_external_id, placed_at desc);

create table order_discounts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  category text not null check (category in ('coupon', 'loyalty', 'other')),
  coupon_external_id bigint,
  coupon_code text,
  amount numeric(12, 2) not null,
  sponsor text not null check (sponsor in ('merchant', 'ifood'))
);
create index order_discounts_coupon_idx on order_discounts (coupon_external_id);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in (
    'draft', 'audience_frozen', 'creation_failed', 'coupon_created',
    'active', 'invitations_sent', 'paused', 'closed'
  )),
  audience_criteria jsonb not null,             -- AudienceCriteria
  offer jsonb,                                  -- Offer
  coupon_input jsonb,                           -- exact CwCouponInput sent, re-sent to activate
  coupon_external_id bigint,
  coupon_code text,
  audience_frozen_at timestamptz,
  activated_at timestamptz,
  invitations_marked_at timestamptz,
  follow_up_ends_at timestamptz,
  created_by uuid references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Frozen audience: the denominator for "who came back".
create table campaign_audience (
  campaign_id uuid not null references campaigns (id) on delete cascade,
  customer_external_id bigint not null,
  included boolean not null,
  exclusion_reason text check (exclusion_reason in ('whatsapp_not_allowed', 'missing_phone', 'recently_invited')),
  primary key (campaign_id, customer_external_id)
);

-- Audit trail of every status transition and external effect.
create table campaign_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references campaigns (id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  details jsonb not null default '{}',
  actor_user_id uuid references users (id),
  created_at timestamptz not null default now()
);

create table campaign_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  body text not null,
  created_by uuid references users (id),
  created_at timestamptz not null default now()
);

-- Webhook inbox. (source, event_id) dedupes CW retries.
create table webhook_events (
  id bigint generated always as identity primary key,
  source text not null check (source in ('cw_orders', 'cw_billing')),
  event_id text not null,
  event_type text not null,
  store_external_id bigint,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (source, event_id)
);

-- Work queue for CW calls, processed under per-store rate limits.
create table sync_jobs (
  id bigint generated always as identity primary key,
  job_type text not null check (job_type in ('backfill_order_history', 'fetch_order_details', 'sync_customers', 'daily_reconciliation')),
  store_external_id bigint not null,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  attempts int not null default 0,
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now()
);
create index sync_jobs_due_idx on sync_jobs (status, run_after);

-- Lock everything down: no anon/authenticated access.
alter table stores enable row level security;
alter table store_credentials enable row level security;
alter table store_access enable row level security;
alter table users enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_discounts enable row level security;
alter table campaigns enable row level security;
alter table campaign_audience enable row level security;
alter table campaign_events enable row level security;
alter table campaign_notes enable row level security;
alter table webhook_events enable row level security;
alter table sync_jobs enable row level security;
