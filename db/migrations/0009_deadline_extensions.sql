-- The scenario changes from sales discounts to supplier deadline extensions. The
-- engine is the same; the request carries a supplier, a sourcing event and a number
-- of days instead of a customer, a deal value and a percentage.
delete from dealdesk.events;
delete from dealdesk.inbound_emails;
delete from dealdesk.inbound_messages;
delete from dealdesk.requests;

alter table dealdesk.requests rename column customer to supplier;
alter table dealdesk.requests add column sourcing_event text not null;
alter table dealdesk.requests drop column amount_cents;
alter table dealdesk.requests drop column currency;
alter table dealdesk.requests drop column discount_percent;
alter table dealdesk.requests add column extension_days integer not null
  check (extension_days >= 1 and extension_days <= 365);

alter table dealdesk.requests drop constraint requests_status_check;
alter table dealdesk.requests add constraint requests_status_check
  check (status in ('pending_review', 'pending_lead', 'approved', 'rejected'));

alter table dealdesk.requests drop constraint requests_approver_role_check;
alter table dealdesk.requests add constraint requests_approver_role_check
  check (approver_role in ('sourcing_lead'));
