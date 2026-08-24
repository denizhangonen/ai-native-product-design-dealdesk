import type { ApproverRole, DeadlineRequest } from "@/domain/request";
import type { RequestStatus } from "@/domain/status";

export type RequestRow = {
  id: string;
  reference: string;
  slack_user_id: string;
  requester_name: string;
  supplier: string;
  sourcing_event: string;
  extension_days: number;
  reason: string | null;
  status: string;
  approver_role: string | null;
  parse_confidence: string | null;
  parse_rationale: string | null;
  parse_model: string | null;
  created_at: Date;
  updated_at: Date;
};

// Postgres returns numeric as a string to protect precision.
export function toDeadlineRequest(row: RequestRow): DeadlineRequest {
  return {
    id: row.id,
    reference: row.reference,
    requester: {
      slackUserId: row.slack_user_id,
      displayName: row.requester_name,
    },
    supplier: row.supplier,
    event: row.sourcing_event,
    extensionDays: row.extension_days,
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
