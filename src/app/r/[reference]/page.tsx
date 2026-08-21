import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { HowItWasDecided } from "@/components/HowItWasDecided";
import { StatusBadge } from "@/components/StatusBadge";
import { Timeline } from "@/components/Timeline";
import { listEvents } from "@/data/events";
import { getRequestByReference } from "@/data/requests";
import { formatAmount } from "@/domain/request";
import { decideRoute } from "@/domain/rules";
import { isFinal } from "@/domain/status";
import { getConfig } from "@/config";

export const dynamic = "force-dynamic";

const REFERENCE = /^DD-\d{1,12}$/;

export async function generateMetadata({ params }: PageProps<"/r/[reference]">) {
  const { reference } = await params;
  return REFERENCE.test(reference) ? { title: reference } : {};
}

export default async function RequestPage({ params }: PageProps<"/r/[reference]">) {
  const { reference } = await params;
  if (!REFERENCE.test(reference)) notFound();

  const request = await getRequestByReference(reference);
  if (!request) notFound();

  const events = await listEvents(request.id);
  // Recomputed rather than stored: the rule is the same one that ran at the time.
  const routing = decideRoute(request, getConfig().APPROVAL_THRESHOLD_PERCENT);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/" className="text-sm text-gray-500 underline-offset-2 hover:underline">
        All requests
      </Link>

      <header className="mt-4 mb-8 flex items-baseline justify-between gap-4">
        <h1 className="font-mono text-2xl font-semibold">{request.reference}</h1>
        <StatusBadge status={request.status} />
      </header>

      <dl className="mb-10 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
        <dt className="text-gray-500">Customer</dt>
        <dd>{request.customer}</dd>
        <dt className="text-gray-500">Deal value</dt>
        <dd className="tabular-nums">{formatAmount(request)}</dd>
        <dt className="text-gray-500">Discount</dt>
        <dd className="tabular-nums">{request.discountPercent}%</dd>
      </dl>

      <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-500">
        How this was decided
      </h2>
      <div className="mb-10">
        <HowItWasDecided request={request} routing={routing} />
      </div>

      <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-500">Timeline</h2>
      <Timeline events={events} />
      <AutoRefresh everySeconds={5} active={!isFinal(request.status)} />
    </main>
  );
}
