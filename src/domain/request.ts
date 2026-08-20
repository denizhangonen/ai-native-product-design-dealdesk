import type { RequestStatus } from "@/domain/status";

export type ApproverRole = "finance";

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

export type DiscountRequest = {
  id: string;
  /** Human-facing identifier used in email subjects, e.g. DD-1042. */
  reference: string;
  requester: Requester;
  customer: string;
  amountCents: number;
  currency: string;
  discountPercent: number;
  reason: string | null;
  status: RequestStatus;
  approverRole: ApproverRole | null;
  reading: Reading | null;
  createdAt: Date;
  updatedAt: Date;
};

export function formatAmount(request: Pick<DiscountRequest, "amountCents" | "currency">): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: request.currency,
    maximumFractionDigits: 0,
  }).format(request.amountCents / 100);
}
