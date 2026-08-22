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
  const last = events.length - 1;

  return (
    <ol className="relative ml-2 border-l border-gray-200 dark:border-gray-800">
      {events.map((event, index) => (
        <li key={event.id} className="relative pb-8 pl-8 last:pb-0">
          <span
            aria-hidden
            className={`absolute top-1 -left-[7px] h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-950 ${
              index === last ? "bg-violet-500" : "bg-gray-300 dark:bg-gray-700"
            }`}
          />
          <p className="text-base font-medium">{DESCRIBE[event.type] ?? event.type}</p>
          <time className="mt-1 block text-sm tabular-nums text-gray-500">
            {formatWhen(event.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}
