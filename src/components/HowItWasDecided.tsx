import type { DiscountRequest } from "@/domain/request";
import type { RoutingDecision } from "@/domain/rules";

function Panel({ title, footer, children }: { title: string; footer: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</h3>
      <p className="mt-2 text-sm">{children}</p>
      <p className="mt-3 text-xs text-gray-500">{footer}</p>
    </section>
  );
}

/**
 * The point of the whole system, on one screen: the model reports what it read,
 * and a rule in code decides what happens. Neither panel can do the other's job.
 */
export function HowItWasDecided({
  request,
  routing,
}: {
  request: DiscountRequest;
  routing: RoutingDecision;
}) {
  const reading = request.reading;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Panel
        title="The model read"
        footer={
          reading
            ? `${Math.round(reading.confidence * 100)}% confident · ${reading.model}`
            : "Not recorded for this request"
        }
      >
        {reading?.rationale ?? "No note was returned."}
      </Panel>

      <Panel title="The rule decided" footer="src/domain/rules.ts, a pure function with tests">
        {routing.reason}
      </Panel>
    </div>
  );
}
