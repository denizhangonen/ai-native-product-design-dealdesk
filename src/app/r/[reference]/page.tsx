import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { HowItWasDecided } from "@/components/HowItWasDecided";
import { StatusBadge } from "@/components/StatusBadge";
import { Timeline } from "@/components/Timeline";
import { listEvents } from "@/data/events";
import { getRequestByReference } from "@/data/requests";
import { formatWhen } from "@/components/format";
import { formatExtension } from "@/domain/request";
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
  const routing = decideRoute(request, getConfig().AUTO_APPROVE_MAX_DAYS);

  return (
    <main className="mx-auto max-w-2xl px-6 py-14 sm:px-10">
      <Link
        href="/"
        className="text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-400"
      >
        &larr; All requests
      </Link>

      <header className="mt-6 mb-10">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">
            <span className="font-mono">{request.reference}</span>
            <span className="text-gray-400 dark:text-gray-600"> · </span>
            {request.supplier}
          </h1>
          <StatusBadge status={request.status} />
        </div>
        <p className="mt-3 max-w-xl text-base text-gray-600 dark:text-gray-400">
          The full trail: what was asked, what the model read, which rule fired, who decided,
          when.
        </p>
      </header>

      <dl className="mb-12 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Event
          </dt>
          <dd className="mt-1.5 font-mono text-lg font-medium">{request.event}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Extension
          </dt>
          <dd className="mt-1.5 text-lg font-medium tabular-nums">
            {formatExtension(request.extensionDays)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Requested
          </dt>
          <dd className="mt-1.5 text-sm tabular-nums whitespace-nowrap text-gray-700 dark:text-gray-300">
            {formatWhen(request.createdAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Last change
          </dt>
          <dd className="mt-1.5 text-sm tabular-nums whitespace-nowrap text-gray-700 dark:text-gray-300">
            {formatWhen(request.updatedAt)}
          </dd>
        </div>
      </dl>

      <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        How this was decided
      </h2>
      <div className="mb-12">
        <HowItWasDecided request={request} routing={routing} />
      </div>

      <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Timeline
      </h2>
      <Timeline events={events} />
      <AutoRefresh everySeconds={5} active={!isFinal(request.status)} />
    </main>
  );
}
