import { type Executor, db } from "@/data/db";
import { type RequestRow, toDeadlineRequest } from "@/data/rows";
import type { ApproverRole, DeadlineRequest, Reading, Requester } from "@/domain/request";
import type { RequestStatus } from "@/domain/status";

const MAX_LIST_LIMIT = 200;

export type InsertRequestInput = {
  requester: Requester;
  supplier: string;
  event: string;
  extensionDays: number;
  reason: string | null;
  status: RequestStatus;
  reading: Reading | null;
};

export async function insertRequest(
  input: InsertRequestInput,
  sql: Executor = db(),
): Promise<DeadlineRequest> {
  const [row] = await sql<RequestRow[]>`
    insert into requests
      (slack_user_id, requester_name, supplier, sourcing_event, extension_days, reason, status,
       parse_confidence, parse_rationale, parse_model)
    values
      (${input.requester.slackUserId}, ${input.requester.displayName}, ${input.supplier},
       ${input.event}, ${input.extensionDays}, ${input.reason}, ${input.status},
       ${input.reading?.confidence ?? null}, ${input.reading?.rationale ?? null},
       ${input.reading?.model ?? null})
    returning *
  `;
  return toDeadlineRequest(row);
}

export async function getRequest(
  id: string,
  sql: Executor = db(),
): Promise<DeadlineRequest | null> {
  const [row] = await sql<RequestRow[]>`select * from requests where id = ${id}`;
  return row ? toDeadlineRequest(row) : null;
}

/**
 * Reads a request and holds the row until the transaction ends. Two replies
 * arriving at once are then serialised instead of overwriting each other.
 */
export async function getRequestForUpdate(
  id: string,
  sql: Executor,
): Promise<DeadlineRequest | null> {
  const [row] = await sql<RequestRow[]>`select * from requests where id = ${id} for update`;
  return row ? toDeadlineRequest(row) : null;
}

export async function getRequestByReference(
  reference: string,
  sql: Executor = db(),
): Promise<DeadlineRequest | null> {
  const [row] = await sql<RequestRow[]>`select * from requests where reference = ${reference}`;
  return row ? toDeadlineRequest(row) : null;
}

export async function listRecent(limit = 50, sql: Executor = db()): Promise<DeadlineRequest[]> {
  const capped = Math.min(Math.max(limit, 1), MAX_LIST_LIMIT);
  const rows = await sql<RequestRow[]>`
    select * from requests order by created_at desc limit ${capped}
  `;
  return rows.map(toDeadlineRequest);
}

export async function updateStatus(
  id: string,
  status: RequestStatus,
  approverRole: ApproverRole | null,
  sql: Executor = db(),
): Promise<DeadlineRequest> {
  const [row] = await sql<RequestRow[]>`
    update requests
       set status = ${status}, approver_role = ${approverRole}, updated_at = now()
     where id = ${id}
    returning *
  `;
  return toDeadlineRequest(row);
}
