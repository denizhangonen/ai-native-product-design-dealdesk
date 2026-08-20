import { type Executor, db } from "@/data/db";

const MAX_LIST_LIMIT = 200;

export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

export type AuditEvent = {
  id: number;
  requestId: string;
  type: string;
  actor: string;
  payload: JsonObject;
  createdAt: Date;
};

type EventRow = {
  id: string;
  request_id: string;
  type: string;
  actor: string;
  payload: JsonObject;
  created_at: Date;
};

function toAuditEvent(row: EventRow): AuditEvent {
  return {
    id: Number(row.id),
    requestId: row.request_id,
    type: row.type,
    actor: row.actor,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

export type AppendEventInput = {
  requestId: string;
  type: string;
  actor: string;
  payload?: JsonObject;
};

export async function appendEvent(
  input: AppendEventInput,
  sql: Executor = db(),
): Promise<AuditEvent> {
  const [row] = await sql<EventRow[]>`
    insert into events (request_id, type, actor, payload)
    values (${input.requestId}, ${input.type}, ${input.actor}, ${sql.json(input.payload ?? {})})
    returning *
  `;
  return toAuditEvent(row);
}

export async function listEvents(
  requestId: string,
  limit = 100,
  sql: Executor = db(),
): Promise<AuditEvent[]> {
  const capped = Math.min(Math.max(limit, 1), MAX_LIST_LIMIT);
  const rows = await sql<EventRow[]>`
    select * from events where request_id = ${requestId} order by created_at asc limit ${capped}
  `;
  return rows.map(toAuditEvent);
}
