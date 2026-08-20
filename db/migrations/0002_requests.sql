create sequence if not exists dealdesk.request_reference_seq start 1001;

create table if not exists dealdesk.requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('DD-' || nextval('dealdesk.request_reference_seq')),
  slack_user_id text not null,
  requester_name text not null,
  customer text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency char(3) not null default 'USD',
  discount_percent numeric(5, 2) not null check (discount_percent >= 0 and discount_percent <= 100),
  reason text,
  status text not null check (status in ('pending_review', 'pending_finance', 'approved', 'rejected')),
  approver_role text check (approver_role in ('finance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists requests_status_idx on dealdesk.requests (status);
create index if not exists requests_created_at_idx on dealdesk.requests (created_at desc);

-- Append-only audit trail. Nothing here is ever updated or deleted.
create table if not exists dealdesk.events (
  id bigint generated always as identity primary key,
  request_id uuid not null references dealdesk.requests (id) on delete cascade,
  type text not null,
  actor text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_request_id_idx on dealdesk.events (request_id, created_at);
