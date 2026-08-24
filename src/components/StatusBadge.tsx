import type { RequestStatus } from "@/domain/status";

const LABEL: Record<RequestStatus, string> = {
  pending_review: "Reviewing",
  pending_lead: "With sourcing lead",
  approved: "Approved",
  rejected: "Rejected",
};

const TONE: Record<RequestStatus, string> = {
  pending_review: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending_lead: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${TONE[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}
