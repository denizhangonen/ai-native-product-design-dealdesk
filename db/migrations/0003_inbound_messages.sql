-- Raw Slack deliveries. The unique event_id is what makes a retried delivery harmless.
create table if not exists dealdesk.inbound_messages (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  channel_id text not null,
  slack_user_id text not null,
  message_ts text not null,
  text text not null,
  received_at timestamptz not null default now()
);

create index if not exists inbound_messages_received_at_idx
  on dealdesk.inbound_messages (received_at desc);
