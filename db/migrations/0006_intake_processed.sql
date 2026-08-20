-- A delivery is only a duplicate once it has been handled to completion. Without
-- this, a delivery that failed halfway was treated as already done on retry, and
-- a genuine approval could be dropped in silence.
alter table dealdesk.inbound_messages add column if not exists processed_at timestamptz;
alter table dealdesk.inbound_emails add column if not exists processed_at timestamptz;

-- Rows that predate this column were all handled, so record them as such.
update dealdesk.inbound_messages set processed_at = received_at where processed_at is null;
update dealdesk.inbound_emails set processed_at = received_at where processed_at is null;
