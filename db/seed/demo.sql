-- Demo data for the public status page. Invented suppliers and events only.
-- Evenings over two weeks, 21:00-23:00 Istanbul time, stored in UTC (Istanbul is UTC+3).
begin;

delete from dealdesk.events;
delete from dealdesk.inbound_emails;
delete from dealdesk.inbound_messages;
delete from dealdesk.requests;

insert into dealdesk.requests
  (reference, slack_user_id, requester_name, supplier, sourcing_event, extension_days,
   reason, status, approver_role, parse_confidence, parse_rationale, parse_model, created_at, updated_at)
values
  ('DD-1021','U_DEMO','Dee Manager','Meridian Supply',    'RFP-2041', 2,'their plant lost power for two days',      'approved',     null,          0.95,'Supplier, event and number of days are all stated plainly.',                   'openai:gpt-4.1-nano','2026-08-10 18:12:00+00','2026-08-10 18:12:03+00'),
  ('DD-1022','U_DEMO','Dee Manager','Nordvik Components', 'RFQ-318',  7,'their lead engineer is off sick',          'approved',     'sourcing_lead',0.90,'Read a week as 7 days; the supplier is named in full.',                          'openai:gpt-4.1-nano','2026-08-10 19:05:00+00','2026-08-10 19:41:00+00'),
  ('DD-1023','U_DEMO','Dee Manager','Atlas Freight',      'RFP-2044', 3,'customs delay on their samples',           'approved',     null,          0.93,'Three days on RFP-2044, with customs given as the reason.',                      'openai:gpt-4.1-nano','2026-08-11 18:20:00+00','2026-08-11 18:20:02+00'),
  ('DD-1024','U_DEMO','Dee Manager','Halcyon Plastics',   'RFQ-322', 10,'they want to requote after a resin price move','rejected',  'sourcing_lead',0.94,'Ten days is asked for outright, tied to a price change.',                        'openai:gpt-4.1-nano','2026-08-11 19:02:00+00','2026-08-11 19:55:00+00'),
  ('DD-1025','U_DEMO','Dee Manager','Cobalt Metals',      'RFQ-77',   1,'a public holiday at their end',            'approved',     null,          0.97,'One extra day, with a holiday given as the reason.',                             'openai:gpt-4.1-nano','2026-08-12 18:07:00+00','2026-08-12 18:07:02+00'),
  ('DD-1026','U_DEMO','Dee Manager','Brightline Logistics','RFP-2046', 5,'waiting on a subcontractor quote',         'approved',     'sourcing_lead',0.91,'Five days on RFP-2046; the reason names a subcontractor.',                       'openai:gpt-4.1-nano','2026-08-12 19:30:00+00','2026-08-12 19:58:00+00'),
  ('DD-1027','U_DEMO','Dee Manager','Aurora Packaging',   'RFP-2041', 2,'their sample courier was delayed',         'approved',     null,          0.96,'Two days on RFP-2041, with a courier delay as the reason.',                      'openai:gpt-4.1-nano','2026-08-13 18:48:00+00','2026-08-13 18:48:03+00'),
  ('DD-1028','U_DEMO','Dee Manager','Stellar Fasteners',  'RFQ-325',  4,'their quality certificate renewal is pending','approved',   'sourcing_lead',0.89,'Four days on RFQ-325; the reason is a pending certificate.',                     'openai:gpt-4.1-nano','2026-08-14 18:10:00+00','2026-08-14 19:25:00+00'),
  ('DD-1029','U_DEMO','Dee Manager','Kestrel Print',      'RFP-2048', 3,null,                                       'approved',     null,          0.88,'Three days on RFP-2048; no reason is offered.',                                  'openai:gpt-4.1-nano','2026-08-17 18:35:00+00','2026-08-17 18:35:02+00'),
  ('DD-1030','U_DEMO','Dee Manager','Ondine Chemicals',   'RFQ-330', 14,'they asked for two more weeks to run a trial batch','rejected','sourcing_lead',0.92,'Read two weeks as 14 days; a trial batch is the stated reason.',                 'openai:gpt-4.1-nano','2026-08-18 18:25:00+00','2026-08-18 19:48:00+00'),
  ('DD-1031','U_DEMO','Dee Manager','Nordvik Components', 'RFP-2050', 2,'their site visit slipped a day',           'approved',     null,          0.95,'Two days on RFP-2050 for a supplier seen before this week.',                     'openai:gpt-4.1-nano','2026-08-19 18:05:00+00','2026-08-19 18:05:03+00'),
  ('DD-1032','U_DEMO','Dee Manager','Vantage Tooling',    'RFQ-333',  6,'they need sign-off from their parent company','approved',   'sourcing_lead',0.93,'Six days on RFQ-333; sign-off from a parent company is the reason.',             'openai:gpt-4.1-nano','2026-08-19 19:12:00+00','2026-08-19 19:50:00+00'),
  ('DD-1033','U_DEMO','Dee Manager','Northgate Textiles', 'RFP-2052', 5,'their sampling line is down for maintenance','pending_lead','sourcing_lead',0.94,'Five days on RFP-2052, with maintenance given as the reason.',                   'openai:gpt-4.1-nano','2026-08-20 18:50:00+00','2026-08-20 18:50:00+00'),
  ('DD-1034','U_DEMO','Dee Manager','Meridian Supply',    'RFQ-336',  8,'they are waiting on a raw material quote', 'pending_lead','sourcing_lead',0.90,'Eight days on RFQ-336 for a supplier seen earlier this month.',                  'openai:gpt-4.1-nano','2026-08-21 18:30:00+00','2026-08-21 18:30:00+00'),
  ('DD-1035','U_DEMO','Dee Manager','Atlas Freight',      'RFP-2054', 4,'a strike at the port has held their samples','pending_lead','sourcing_lead',0.96,'Four days on RFP-2054, with a port strike as the reason.',                       'openai:gpt-4.1-nano','2026-08-21 19:15:00+00','2026-08-21 19:15:00+00');

insert into dealdesk.events (request_id, type, actor, payload, created_at)
select r.id, 'created', 'U_DEMO',
       jsonb_build_object('supplier', r.supplier, 'event', r.sourcing_event,
                          'extensionDays', r.extension_days, 'confidence', r.parse_confidence),
       r.created_at
  from dealdesk.requests r;

insert into dealdesk.events (request_id, type, actor, payload, created_at)
select r.id,
       case when r.approver_role is null then 'auto_approved' else 'submitted' end,
       'system',
       case when r.approver_role is null
            then jsonb_build_object('route','auto','reason',
                   r.extension_days || case when r.extension_days = 1 then ' day' else ' days' end || ' is within the 3-day limit')
            else jsonb_build_object('route','lead','reason',
                   r.extension_days || ' days is above the 3-day limit, so the sourcing lead must approve')
       end,
       r.created_at + interval '2 seconds'
  from dealdesk.requests r;

insert into dealdesk.events (request_id, type, actor, payload, created_at)
select r.id, 'lead_approved', 'sourcing_lead', '{}'::jsonb, r.updated_at
  from dealdesk.requests r
 where r.status = 'approved' and r.approver_role = 'sourcing_lead';

insert into dealdesk.events (request_id, type, actor, payload, created_at)
select r.id, 'lead_rejected', 'sourcing_lead',
       jsonb_build_object('note', '3 days is the most we can give - counter offer 3 days'),
       r.updated_at
  from dealdesk.requests r
 where r.status = 'rejected';

select setval('dealdesk.request_reference_seq', 1035);

commit;
