import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { type DeadlineRequest, formatExtension } from "@/domain/request";

export function RequestTable({ requests }: { requests: DeadlineRequest[] }) {
  if (requests.length === 0) {
    return <p className="text-gray-500">No requests yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-base">
        <thead className="text-left text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          <tr>
            <th className="py-3 pr-6">Ref</th>
            <th className="py-3 pr-6">Supplier</th>
            <th className="py-3 pr-6">Event</th>
            <th className="py-3 pr-6">Extension</th>
            <th className="py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
          {requests.map((request) => (
            <tr
              key={request.id}
              className="transition-colors hover:bg-violet-50/60 dark:hover:bg-violet-950/20"
            >
              <td className="py-4 pr-6 font-mono text-[15px]">
                <Link
                  href={`/r/${request.reference}`}
                  className="font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-400"
                >
                  {request.reference}
                </Link>
              </td>
              <td className="py-4 pr-6 font-medium">{request.supplier}</td>
              <td className="py-4 pr-6 font-mono text-[15px] text-gray-600 dark:text-gray-300">
                {request.event}
              </td>
              <td className="py-4 pr-6 tabular-nums text-gray-600 dark:text-gray-300">
                {formatExtension(request.extensionDays)}
              </td>
              <td className="py-4">
                <StatusBadge status={request.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
