import { formatWhen } from "@/components/format";
import type { AuditEvent } from "@/data/events";

// What each audit event means to a reader. Actors are deliberately not shown:
// this page is public and actors can be email addresses.
const DESCRIBE: Record<string, string> = {
  created: "Request received from Slack",
  submitted: "Above the limit, sent to finance",
  auto_approved: "Within the limit, approved automatically",
  finance_approved: "Approved by finance",
  finance_rejected: "Rejected by finance",
};

export function Timeline({ events }: { events: AuditEvent[] }) {
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="flex gap-4 text-sm">
          <time className="w-40 shrink-0 tabular-nums text-gray-500">
            {formatWhen(event.createdAt)}
          </time>
          <span>{DESCRIBE[event.type] ?? event.type}</span>
        </li>
      ))}
    </ol>
  );
}
