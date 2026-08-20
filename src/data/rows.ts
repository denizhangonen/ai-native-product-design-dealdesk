import type { ApproverRole, DiscountRequest } from "@/domain/request";
import type { RequestStatus } from "@/domain/status";

export type RequestRow = {
  id: string;
  reference: string;
  slack_user_id: string;
  requester_name: string;
  customer: string;
  amount_cents: string;
  currency: string;
  discount_percent: string;
  reason: string | null;
  status: string;
  approver_role: string | null;
  parse_confidence: string | null;
  parse_rationale: string | null;
  parse_model: string | null;
  created_at: Date;
  updated_at: Date;
};

// Postgres returns bigint and numeric as strings to protect precision.
export function toDiscountRequest(row: RequestRow): DiscountRequest {
  return {
    id: row.id,
    reference: row.reference,
    requester: {
      slackUserId: row.slack_user_id,
      displayName: row.requester_name,
    },
    customer: row.customer,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    discountPercent: Number(row.discount_percent),
    reason: row.reason,
    status: row.status as RequestStatus,
    approverRole: row.approver_role as ApproverRole | null,
    reading: row.parse_model
      ? {
          confidence: Number(row.parse_confidence),
          rationale: row.parse_rationale,
          model: row.parse_model,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
