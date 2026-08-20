-- Where a request came from. Keeping this here rather than on requests means the
-- business record carries no Slack details, and the reply thread is still findable.
alter table dealdesk.inbound_messages
  add column if not exists request_id uuid references dealdesk.requests (id) on delete set null;

create unique index if not exists inbound_messages_request_id_idx
  on dealdesk.inbound_messages (request_id)
  where request_id is not null;
