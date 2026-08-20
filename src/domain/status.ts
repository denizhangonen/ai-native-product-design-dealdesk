import { InvalidTransition } from "@/domain/errors";

export const REQUEST_STATUSES = [
  "pending_review",
  "pending_finance",
  "approved",
  "rejected",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_EVENTS = [
  "submitted",
  "auto_approved",
  "finance_approved",
  "finance_rejected",
] as const;

export type RequestEvent = (typeof REQUEST_EVENTS)[number];

const TRANSITIONS: Record<RequestStatus, Partial<Record<RequestEvent, RequestStatus>>> = {
  pending_review: { submitted: "pending_finance", auto_approved: "approved" },
  pending_finance: {
    finance_approved: "approved",
    finance_rejected: "rejected",
  },
  approved: {},
  rejected: {},
};

export function transition(from: RequestStatus, event: RequestEvent): RequestStatus {
  const next = TRANSITIONS[from][event];
  if (!next) throw new InvalidTransition(from, event);
  return next;
}

export function isFinal(status: RequestStatus): boolean {
  return status === "approved" || status === "rejected";
}
