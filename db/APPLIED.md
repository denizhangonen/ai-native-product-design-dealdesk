# Applied migrations

There is no migration history table on this shared Supabase project, so record every apply here by hand.

| Environment | Applied through | Checked |
| --- | --- | --- |
| Production (`pvgysdiwujwmeivkxsam`, schema `dealdesk`) | 0007 | 20 Aug 2026, verified against the database |

| Migration | What it adds |
| --- | --- |
| 0001 | The `dealdesk` schema |
| 0002 | `requests` and `events`, plus the `DD-####` reference sequence |
| 0003 | `inbound_messages`, the raw Slack deliveries and the de-duplication key |
| 0004 | The link from an inbound message to the request it became |
| 0005 | `inbound_emails`, the approver replies and their de-duplication key |
| 0006 | `processed_at` on both intake tables, so a half-finished delivery can be retried |
| 0007 | How the model read the message: confidence, its one-line note, and the model name |

## How to apply

Migrations run through the Supabase Management API as `postgres`, which leaves the
project's own migration history untouched. Wrap multi-statement ranges in
`begin; ... commit;` so a range lands whole or not at all.

```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -w)
python3 -c "import json;json.dump({'query':open('db/migrations/0001_schema.sql').read()},open('/tmp/p.json','w'))"
curl -s -X POST "https://api.supabase.com/v1/projects/pvgysdiwujwmeivkxsam/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data @/tmp/p.json
```

## Roles

The application never connects as `postgres`. `db/bootstrap.example.sql` shows the
one-time creation of `dealdesk_app`, which has `usage` on the `dealdesk` schema only.
Verified 20 Aug 2026: it cannot read another application's schema and cannot create
objects in `public`.
