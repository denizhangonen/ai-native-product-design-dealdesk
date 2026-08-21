-- A delivery that is still being handled must not be mistaken for one that died.
-- Without this, a provider retry arriving while the first attempt was still running
-- was treated as a fresh attempt, and one Slack message produced two requests.
alter table dealdesk.inbound_messages add column if not exists claimed_at timestamptz not null default now();
alter table dealdesk.inbound_emails  add column if not exists claimed_at timestamptz not null default now();

update dealdesk.inbound_messages set claimed_at = received_at;
update dealdesk.inbound_emails  set claimed_at = received_at;
