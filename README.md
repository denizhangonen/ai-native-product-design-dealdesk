# Dealdesk

A discount approval flow that lives where the work already happens.

A sales rep asks for a discount in Slack. The request is understood, the rule is applied
in code, and finance approves by replying to an ordinary email. The rep hears back in the
same Slack thread. Nobody opens a new app.

This is a **working slice, not a product**. It exists to show what AI-native product design
looks like when the software comes to the user instead of waiting to be fed.

Live at **https://ai-native-dealdesk.vercel.app**

## Status

The full loop works end to end against real services: a Slack request comes in, a model
extracts the fields, code decides the route, finance approves by replying to an ordinary
email, the rep hears back in the same Slack thread, and the status page updates. Mail is
sent and received through Resend on a subdomain of its own. Running locally, a stand-in
provider keeps the whole flow working with no account and no network.

`/` lists recent requests, `/r/DD-1042` shows one request. Each request records two things
side by side: the model's own note on how it read the message, with the confidence and the
model name, and the rule that decided the route. Telling those apart is the point.

Both pages are public and read-only, so they show no names and no email addresses.

## Stack

Next.js (App Router, TypeScript), Postgres on Supabase, deployed on Vercel.
Slack and email need a public HTTPS URL to deliver events to, which is the whole reason
this is deployed rather than run locally.

## Layout

Each layer is a folder under `src/`, and may only import from the layers below it.

| Layer | Folder | Holds |
| --- | --- | --- |
| Domain | `src/domain/` | Types, state machine, business rules. Pure functions, no I/O. |
| Data | `src/data/` | SQL queries, one file per concept. |
| AI | `src/ai/` | Prompts, model calls, output schemas and validation. |
| Integrations | `src/integrations/` | One folder per external system (Slack, email). |
| Guards | `src/guards/` | Signature checks, allow-lists, rate limits. |
| Services | `src/services/` | Use cases that orchestrate the layers above. |
| API | `src/app/api/` | Thin route handlers. |
| UI | `src/app/`, `src/components/` | Pages and presentational components. |

The model extracts; code decides. Approval rules live in `src/domain/`, never in a prompt.

What happens when things go wrong, and how each case is proven: [docs/confidence.md](docs/confidence.md).

## Running it

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL
npm run dev
npm run check                # typecheck, lint, tests
```

`GET /api/health` reports whether the app can reach its database.

## Database

Tables live in a dedicated `dealdesk` schema. The application connects as `dealdesk_app`,
a role with access to that schema and nothing else. See `db/APPLIED.md`.

## Not built on purpose

No CRM, no admin UI, no user accounts, no multi-step approval chains. Those are product
surface, and the point here is the workflow.
