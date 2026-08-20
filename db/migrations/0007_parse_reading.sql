-- What the model made of the message, kept beside the request it produced. The
-- decision itself stays a rule in code; this records only how the message was read,
-- so the two can be told apart when looking at any single request.
alter table dealdesk.requests add column if not exists parse_confidence numeric(4, 3);
alter table dealdesk.requests add column if not exists parse_rationale text;
alter table dealdesk.requests add column if not exists parse_model text;

alter table dealdesk.requests drop constraint if exists requests_parse_confidence_range;
alter table dealdesk.requests add constraint requests_parse_confidence_range
  check (parse_confidence is null or (parse_confidence >= 0 and parse_confidence <= 1));
