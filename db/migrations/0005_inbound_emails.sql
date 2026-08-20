-- Raw approver replies. The unique message_id makes a redelivered webhook harmless.
create table if not exists dealdesk.inbound_emails (
  id bigint generated always as identity primary key,
  message_id text not null unique,
  from_address text not null,
  subject text not null,
  reference text,
  received_at timestamptz not null default now()
);

create index if not exists inbound_emails_received_at_idx
  on dealdesk.inbound_emails (received_at desc);
