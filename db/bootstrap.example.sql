-- One-time bootstrap, run as postgres after 0001_schema.sql.
-- The app connects as dealdesk_app, which can only touch the dealdesk schema.
-- Run with a real password; never commit the filled-in version.

create role dealdesk_app with login password '<GENERATED>';

grant usage on schema dealdesk to dealdesk_app;
alter role dealdesk_app set search_path = dealdesk;

alter default privileges in schema dealdesk
  grant select, insert, update, delete on tables to dealdesk_app;
alter default privileges in schema dealdesk
  grant usage, select on sequences to dealdesk_app;
