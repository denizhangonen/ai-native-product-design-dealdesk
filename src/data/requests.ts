import { type Executor, db } from "@/data/db";
import { type RequestRow, toDiscountRequest } from "@/data/rows";
import type { ApproverRole, DiscountRequest, Reading, Requester } from "@/domain/request";
import type { RequestStatus } from "@/domain/status";

const MAX_LIST_LIMIT = 200;

export type InsertRequestInput = {
  requester: Requester;
  customer: string;
  amountCents: number;
  currency: string;
  discountPercent: number;
  reason: string | null;
  status: RequestStatus;
  reading: Reading | null;
};

export async function insertRequest(
  input: InsertRequestInput,
  sql: Executor = db(),
): Promise<DiscountRequest> {
  const [row] = await sql<RequestRow[]>`
    insert into requests
      (slack_user_id, requester_name, customer, amount_cents, currency, discount_percent, reason, status,
       parse_confidence, parse_rationale, parse_model)
    values
      (${input.requester.slackUserId}, ${input.requester.displayName}, ${input.customer},
       ${input.amountCents}, ${input.currency}, ${input.discountPercent}, ${input.reason}, ${input.status},
       ${input.reading?.confidence ?? null}, ${input.reading?.rationale ?? null},
       ${input.reading?.model ?? null})
    returning *
  `;
  return toDiscountRequest(row);
}

export async function getRequest(
  id: string,
  sql: Executor = db(),
): Promise<DiscountRequest | null> {
  const [row] = await sql<RequestRow[]>`select * from requests where id = ${id}`;
  return row ? toDiscountRequest(row) : null;
}

/**
 * Reads a request and holds the row until the transaction ends. Two replies
 * arriving at once are then serialised instead of overwriting each other.
 */
export async function getRequestForUpdate(
  id: string,
  sql: Executor,
): Promise<DiscountRequest | null> {
  const [row] = await sql<RequestRow[]>`select * from requests where id = ${id} for update`;
  return row ? toDiscountRequest(row) : null;
}

export async function getRequestByReference(
  reference: string,
  sql: Executor = db(),
): Promise<DiscountRequest | null> {
  const [row] = await sql<RequestRow[]>`select * from requests where reference = ${reference}`;
  return row ? toDiscountRequest(row) : null;
}

export async function listRecent(limit = 50, sql: Executor = db()): Promise<DiscountRequest[]> {
  const capped = Math.min(Math.max(limit, 1), MAX_LIST_LIMIT);
  const rows = await sql<RequestRow[]>`
    select * from requests order by created_at desc limit ${capped}
  `;
  return rows.map(toDiscountRequest);
}

export async function updateStatus(
  id: string,
  status: RequestStatus,
  approverRole: ApproverRole | null,
  sql: Executor = db(),
): Promise<DiscountRequest> {
  const [row] = await sql<RequestRow[]>`
    update requests
       set status = ${status}, approver_role = ${approverRole}, updated_at = now()
     where id = ${id}
    returning *
  `;
  return toDiscountRequest(row);
}
