import type { RequestStatus } from "@/domain/status";

export type ApproverRole = "sourcing_lead";

/** How the model read the message. It never decides anything; it only reports. */
export type Reading = {
  confidence: number;
  rationale: string | null;
  model: string;
};

export type Requester = {
  slackUserId: string;
  displayName: string;
};

export type DeadlineRequest = {
  id: string;
  /** Human-facing identifier used in email subjects, e.g. DD-1042. */
  reference: string;
  requester: Requester;
  supplier: string;
  /** The sourcing event the deadline belongs to, e.g. RFP-2041. */
  event: string;
  extensionDays: number;
  reason: string | null;
  status: RequestStatus;
  approverRole: ApproverRole | null;
  reading: Reading | null;
  createdAt: Date;
  updatedAt: Date;
};

export function formatExtension(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}
