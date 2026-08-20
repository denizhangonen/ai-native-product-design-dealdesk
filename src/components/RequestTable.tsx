import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { type DiscountRequest, formatAmount } from "@/domain/request";
import { formatWhen } from "@/components/format";

export function RequestTable({ requests }: { requests: DiscountRequest[] }) {
  if (requests.length === 0) {
    return <p className="text-sm text-gray-500">No requests yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="py-2 pr-4">Ref</th>
            <th className="py-2 pr-4">Customer</th>
            <th className="py-2 pr-4">Deal</th>
            <th className="py-2 pr-4">Discount</th>
            <th className="py-2 pr-4">Read</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {requests.map((request) => (
            <tr key={request.id}>
              <td className="py-2 pr-4 font-mono">
                <Link href={`/r/${request.reference}`} className="underline-offset-2 hover:underline">
                  {request.reference}
                </Link>
              </td>
              <td className="py-2 pr-4">{request.customer}</td>
              <td className="py-2 pr-4 tabular-nums">{formatAmount(request)}</td>
              <td className="py-2 pr-4 tabular-nums">{request.discountPercent}%</td>
              <td className="py-2 pr-4 tabular-nums text-gray-500">
                {request.reading ? `${Math.round(request.reading.confidence * 100)}%` : "-"}
              </td>
              <td className="py-2 pr-4">
                <StatusBadge status={request.status} />
              </td>
              <td className="py-2 text-gray-500">{formatWhen(request.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
